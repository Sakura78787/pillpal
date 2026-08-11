import { normalizeTimeKey, toLocalDateKey } from '@/lib/dateTime';

const DAY_MS = 24 * 60 * 60 * 1000;

const parseDateKey = (key) => {
  const [year, month, day] = String(key).slice(0, 10).split('-').map(Number);
  return { year, month, day, utc: Date.UTC(year, month - 1, day) };
};

const eachDateKey = (start, end) => {
  const dates = [];
  for (let time = parseDateKey(start).utc; time <= parseDateKey(end).utc; time += DAY_MS) {
    const date = new Date(time);
    dates.push(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`);
  }
  return dates;
};

const dayOfWeek = (dateKey) => {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(year, month - 1, day).getDay();
};

const isPlanDate = (medication, dateKey) => {
  if (medication.start_date && dateKey < String(medication.start_date).slice(0, 10)) return false;
  if (medication.end_date && dateKey > String(medication.end_date).slice(0, 10)) return false;
  const config = medication.frequency_config || {};
  if (medication.frequency_type === 'weekly') {
    return (config.weeklyDays || []).map(Number).includes(dayOfWeek(dateKey));
  }
  if (medication.frequency_type === 'interval') {
    if (!medication.start_date) return false;
    const difference = (parseDateKey(dateKey).utc - parseDateKey(medication.start_date).utc) / DAY_MS;
    const interval = Math.max(1, Number(config.intervalDays) || 1);
    return difference >= 0 && difference % interval === 0;
  }
  return medication.frequency_type === 'daily';
};

const slotFor = (time) => {
  const hour = Number(normalizeTimeKey(time)?.slice(0, 2));
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'midday';
  if (hour >= 18 && hour <= 23) return 'evening';
  return 'other';
};

const dailyConsumption = (medication) => {
  const dose = Number(medication.dosage);
  if (!Number.isFinite(dose) || dose <= 0) return null;
  const config = medication.frequency_config || {};
  if (medication.frequency_type === 'daily') return dose * (medication.reminder_times?.length || config.dailyTimes || 1);
  if (medication.frequency_type === 'weekly') return dose * ((config.weeklyDays?.length || 0) / 7);
  if (medication.frequency_type === 'interval') return dose / Math.max(1, Number(config.intervalDays) || 1);
  return null;
};

const stockDays = (medication) => {
  const consumption = dailyConsumption(medication);
  const stock = Number(medication.stock_quantity);
  if (!consumption || !Number.isFinite(stock) || stock < 0) return null;
  return Math.floor(stock / consumption);
};

const emptySlot = () => ({ due: 0, taken: 0, skipped: 0, unrecorded: 0 });
const skipReasonCode = (value) => {
  const text = String(value || '').toLowerCase();
  if (/forgot|忘/.test(text)) return 'forgot';
  if (/side.?effect|不适|副作用/.test(text)) return 'discomfort';
  if (/not.?needed|不需要/.test(text)) return 'not_needed';
  return text ? 'other' : 'unspecified';
};

export function buildMedicationRefMap(medications = []) {
  const result = {};
  medications
    .filter((item) => item?.status === 'active' && !item?.deleted_at && item.frequency_type !== 'custom')
    .forEach((item, index) => {
      result[`med_${index + 1}`] = item.name || `药物${index + 1}`;
    });
  return result;
}

export function buildDoseEventFacts({ medications = [], medicationLogs = [], now = new Date(), periodStart, periodEnd }) {
  const currentDateKey = toLocalDateKey(now);
  const currentTimeKey = normalizeTimeKey(`${now.getHours()}:${now.getMinutes()}`);
  const active = medications.filter((item) => item?.status === 'active' && !item?.deleted_at);
  const structured = active.filter((item) => item.frequency_type !== 'custom');
  const refs = new Map(structured.map((item, index) => [String(item.id), `med_${index + 1}`]));
  const dates = eachDateKey(periodStart, periodEnd);
  const events = [];

  for (const medication of structured) {
    for (const date of dates) {
      if (!isPlanDate(medication, date)) continue;
      for (const rawTime of medication.reminder_times || []) {
        const time = normalizeTimeKey(rawTime);
        if (!time || (date === currentDateKey && time > currentTimeKey)) continue;
        events.push({ medicationId: String(medication.id), ref: refs.get(String(medication.id)), date, time, slot: slotFor(time) });
      }
    }
  }

  const usableLogs = medicationLogs.filter((log) => !log?.deleted_at);
  const matchedIndexes = new Set();
  const timeSlotStats = { morning: emptySlot(), midday: emptySlot(), evening: emptySlot(), other: emptySlot() };
  const medicationSummaryMap = new Map(structured.map((item) => [String(item.id), {
    ref: refs.get(String(item.id)), due: 0, taken: 0, skipped: 0, unrecorded: 0,
    recordedTakenRate: null, estimatedStockDays: stockDays(item),
  }]));
  const unrecordedDates = new Set();
  const skipReasonCounts = {};
  let takenDoseCount = 0;
  let skippedDoseCount = 0;
  let unrecordedDoseCount = 0;
  let conflictingLogCount = 0;

  for (const event of events) {
    const matches = [];
    usableLogs.forEach((log, index) => {
      if (String(log.medication_id) === event.medicationId && String(log.scheduled_date).slice(0, 10) === event.date && normalizeTimeKey(log.scheduled_time) === event.time) {
        matches.push({ log, index });
        matchedIndexes.add(index);
      }
    });
    const taken = matches.find(({ log }) => log.status === 'taken');
    const skipped = matches.find(({ log }) => log.status === 'skipped');
    if (taken && skipped) conflictingLogCount += 1;
    const status = taken ? 'taken' : skipped ? 'skipped' : 'unrecorded';
    event.status = status;
    timeSlotStats[event.slot].due += 1;
    timeSlotStats[event.slot][status] += 1;
    const medSummary = medicationSummaryMap.get(event.medicationId);
    medSummary.due += 1;
    medSummary[status] += 1;
    if (status === 'taken') takenDoseCount += 1;
    if (status === 'skipped') {
      skippedDoseCount += 1;
      const reason = skipReasonCode(skipped.log.skip_reason);
      skipReasonCounts[reason] = (skipReasonCounts[reason] || 0) + 1;
    }
    if (status === 'unrecorded') {
      unrecordedDoseCount += 1;
      unrecordedDates.add(event.date);
    }
  }

  const medicationSummaries = [...medicationSummaryMap.values()].map((item) => ({
    ...item,
    recordedTakenRate: item.due ? item.taken / item.due : null,
  }));
  const dueDoseCount = events.length;
  const sortedGapDates = [...unrecordedDates].sort();
  let maxConsecutiveUnrecordedDays = 0;
  let streak = 0;
  let previous = null;
  for (const date of sortedGapDates) {
    const timestamp = parseDateKey(date).utc;
    streak = previous !== null && timestamp - previous === DAY_MS ? streak + 1 : 1;
    maxConsecutiveUnrecordedDays = Math.max(maxConsecutiveUnrecordedDays, streak);
    previous = timestamp;
  }
  const mostUnrecordedTimeSlot = Object.entries(timeSlotStats)
    .filter(([, value]) => value.unrecorded > 0)
    .sort((a, b) => b[1].unrecorded - a[1].unrecorded)[0]?.[0] || null;
  const scoredLogs = usableLogs.filter((log) => Number.isFinite(Number(log.feeling_score)));

  return {
    dueDoseCount,
    takenDoseCount,
    skippedDoseCount,
    unrecordedDoseCount,
    recordedTakenRate: dueDoseCount ? takenDoseCount / dueDoseCount : null,
    statusCoverageRate: dueDoseCount ? (takenDoseCount + skippedDoseCount) / dueDoseCount : null,
    excludedCustomMedicationCount: active.length - structured.length,
    unmatchedLogCount: usableLogs.length - matchedIndexes.size,
    conflictingLogCount,
    timeSlotStats,
    mostUnrecordedTimeSlot,
    affectedDateCount: unrecordedDates.size,
    maxConsecutiveUnrecordedDays,
    medicationSummaries,
    customRecordedCount: usableLogs.filter((log) => {
      const med = active.find((item) => String(item.id) === String(log.medication_id));
      return med?.frequency_type === 'custom';
    }).length,
    feelingScoreCount: scoredLogs.length,
    lowFeelingScoreCount: scoredLogs.filter((log) => Number(log.feeling_score) <= 2).length,
    skipReasonCounts,
  };
}

import { getLocalWeekRange, localDateTimeBoundary } from '@/lib/dateTime';
import { buildDoseEventFacts, buildMedicationRefMap } from './buildDoseEvents.js';
import { buildHealthFacts } from './buildHealthFacts.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const parseDateOnly = (value) => {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return year && month && day ? new Date(Date.UTC(year, month - 1, day)) : null;
};
const isNotDeleted = (item) => !item?.deleted_at;
const inKeyRange = (key, start, end) => key && key >= start && key <= end;

const addDoseEvidence = (facts, evidence) => {
  const keys = ['dueDoseCount', 'takenDoseCount', 'skippedDoseCount', 'unrecordedDoseCount', 'recordedTakenRate', 'statusCoverageRate', 'excludedCustomMedicationCount', 'unmatchedLogCount', 'conflictingLogCount', 'affectedDateCount', 'maxConsecutiveUnrecordedDays', 'feelingScoreCount', 'lowFeelingScoreCount'];
  keys.forEach((key) => { evidence[key] = facts[key]; });
  evidence.recordedTakenRatePercent = facts.recordedTakenRate == null ? null : Math.round(facts.recordedTakenRate * 100);
  evidence.statusCoverageRatePercent = facts.statusCoverageRate == null ? null : Math.round(facts.statusCoverageRate * 100);
  for (const [slot, value] of Object.entries(facts.timeSlotStats)) {
    for (const [status, count] of Object.entries(value)) evidence[`time_${slot}_${status}`] = count;
  }
  facts.medicationSummaries.forEach((item) => {
    evidence[`${item.ref}_due`] = item.due;
    evidence[`${item.ref}_taken`] = item.taken;
    evidence[`${item.ref}_skipped`] = item.skipped;
    evidence[`${item.ref}_unrecorded`] = item.unrecorded;
    evidence[`${item.ref}_stock_days`] = item.estimatedStockDays;
  });
};

const addHealthEvidence = (health, evidence) => {
  for (const [metric, count] of Object.entries(health.totalCounts)) evidence[`health_${metric}_count`] = count;
  const addTrend = (prefix, item) => {
    evidence[`${prefix}_earliest`] = item.earliest;
    evidence[`${prefix}_latest`] = item.latest;
    evidence[`${prefix}_min`] = item.min;
    evidence[`${prefix}_max`] = item.max;
    evidence[`${prefix}_delta`] = item.delta;
  };
  addTrend('health_bp_systolic', health.trends.bloodPressure.systolic);
  addTrend('health_bp_diastolic', health.trends.bloodPressure.diastolic);
  addTrend('health_weight', health.trends.weight);
  addTrend('health_sugar_fasting', health.trends.bloodSugar.fasting);
  addTrend('health_sugar_post_meal', health.trends.bloodSugar.postMeal);
  addTrend('health_sugar_random', health.trends.bloodSugar.random);
};

export function buildWeeklyFacts(sourceData = {}, now = new Date()) {
  const range = getLocalWeekRange(now);
  const medications = sourceData.medications || [];
  const medicationLogs = (sourceData.medicationLogs || []).filter((log) => isNotDeleted(log) && inKeyRange(String(log.scheduled_date).slice(0, 10), range.weekStartDate, range.weekEndDate));
  const weekStart = new Date(localDateTimeBoundary(range.weekStartDate, 'start'));
  const weekEnd = new Date(localDateTimeBoundary(range.weekEndDate, 'end'));
  const healthRecords = (sourceData.healthRecords || []).filter((record) => isNotDeleted(record) && new Date(record.recorded_at) >= weekStart && new Date(record.recorded_at) <= weekEnd);
  const activeMedications = medications.filter((item) => isNotDeleted(item) && item.status === 'active');
  const today = parseDateOnly(range.todayDate);
  const appointmentEnd = parseDateOnly(range.appointmentEndDate);
  const appointments = (sourceData.appointments || []).filter((item) => {
    const date = parseDateOnly(item.appointment_date);
    return isNotDeleted(item) && item.status === 'scheduled' && date && date >= today && date <= appointmentEnd;
  }).sort((a, b) => parseDateOnly(a.appointment_date) - parseDateOnly(b.appointment_date));
  const nextAppointmentDate = parseDateOnly(appointments[0]?.appointment_date);
  const health = buildHealthFacts(healthRecords);
  const dose = buildDoseEventFacts({ medications, medicationLogs, now, periodStart: range.weekStartDate, periodEnd: range.weekEndDate });
  const healthRecordCounts = {
    bloodPressure: health.totalCounts.bloodPressure,
    bloodSugar: health.totalCounts.bloodSugar,
    weight: health.totalCounts.weight,
    other: healthRecords.filter((item) => !['blood_pressure', 'blood_sugar', 'weight'].includes(item.record_type)).length,
  };
  const facts = {
    periodStart: range.weekStartDate,
    periodEnd: range.weekEndDate,
    recordedTakenCount: medicationLogs.filter((log) => log.status === 'taken').length,
    recordedSkippedCount: medicationLogs.filter((log) => log.status === 'skipped').length,
    activeMedicationCount: activeMedications.length,
    lowStockMedicationCount: activeMedications.filter((item) => Number(item.stock_quantity || 0) <= Number(item.low_stock_threshold || 0)).length,
    healthRecordCounts,
    hasUpcomingAppointment: appointments.length > 0,
    nextAppointmentInDays: nextAppointmentDate ? Math.round((nextAppointmentDate - today) / DAY_MS) : null,
    dataGapCodes: [],
    evidence: {},
    ...dose,
    health,
  };
  if (!facts.activeMedicationCount) facts.dataGapCodes.push('no_active_medications');
  if (!facts.dueDoseCount) facts.dataGapCodes.push('no_due_doses');
  if (!healthRecords.length) facts.dataGapCodes.push('no_health_records');
  if (!facts.hasUpcomingAppointment) facts.dataGapCodes.push('no_upcoming_appointments');
  if (facts.excludedCustomMedicationCount) facts.dataGapCodes.push('custom_medications_excluded_from_rate');
  if (facts.unmatchedLogCount) facts.dataGapCodes.push('unmatched_logs_excluded');
  if (facts.conflictingLogCount) facts.dataGapCodes.push('conflicting_logs_detected');
  facts.dataGapCodes.push(...health.dataGapCodes);
  facts.evidence = {
    period_day_count: 7,
    recorded_taken_count: facts.recordedTakenCount,
    recorded_skipped_count: facts.recordedSkippedCount,
    active_medication_count: facts.activeMedicationCount,
    low_stock_medication_count: facts.lowStockMedicationCount,
    has_upcoming_appointment: facts.hasUpcomingAppointment,
    next_appointment_in_days: facts.nextAppointmentInDays,
  };
  addDoseEvidence(facts, facts.evidence);
  addHealthEvidence(health, facts.evidence);
  return facts;
}

export function buildWeeklyReportContext(sourceData = {}, now = new Date()) {
  return {
    facts: buildWeeklyFacts(sourceData, now),
    medicationNamesByRef: buildMedicationRefMap(sourceData.medications || []),
  };
}

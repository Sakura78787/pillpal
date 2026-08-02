const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
const UPCOMING_APPOINTMENT_DAYS = 14;

const toDateKey = (date) => date.toISOString().slice(0, 10);

const startOfUtcDay = (value) => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const parseDateOnly = (value) => {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
};

const isNotDeleted = (item) => !item?.deleted_at;

const isDateInRange = (date, start, end) => {
  if (!date || Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
};

const countBy = (items, predicate) => items.filter(predicate).length;

const buildEvidence = (facts) => ({
  recorded_taken_count: facts.recordedTakenCount,
  recorded_skipped_count: facts.recordedSkippedCount,
  active_medication_count: facts.activeMedicationCount,
  low_stock_medication_count: facts.lowStockMedicationCount,
  health_blood_pressure_count: facts.healthRecordCounts.bloodPressure,
  health_blood_sugar_count: facts.healthRecordCounts.bloodSugar,
  health_weight_count: facts.healthRecordCounts.weight,
  health_other_count: facts.healthRecordCounts.other,
  has_upcoming_appointment: facts.hasUpcomingAppointment,
  next_appointment_in_days: facts.nextAppointmentInDays,
});

export function buildWeeklyFacts(sourceData = {}, now = new Date()) {
  const end = startOfUtcDay(now);
  const start = new Date(end.getTime() - (WEEK_DAYS - 1) * DAY_MS);
  const upcomingEnd = new Date(end.getTime() + UPCOMING_APPOINTMENT_DAYS * DAY_MS);

  const medications = sourceData.medications || [];
  const medicationLogs = sourceData.medicationLogs || [];
  const healthRecords = sourceData.healthRecords || [];
  const appointments = sourceData.appointments || [];

  const activeMedications = medications.filter(
    (medication) => isNotDeleted(medication) && medication.status === 'active'
  );
  const weekLogs = medicationLogs.filter((log) =>
    isNotDeleted(log) && isDateInRange(parseDateOnly(log.scheduled_date), start, end)
  );
  const weekHealthRecords = healthRecords.filter((record) =>
    isNotDeleted(record) && isDateInRange(new Date(record.recorded_at), start, new Date(end.getTime() + DAY_MS - 1))
  );
  const upcomingAppointments = appointments
    .filter((appointment) => {
      const date = parseDateOnly(appointment.appointment_date);
      return (
        isNotDeleted(appointment) &&
        appointment.status === 'scheduled' &&
        isDateInRange(date, end, upcomingEnd)
      );
    })
    .sort((a, b) => parseDateOnly(a.appointment_date) - parseDateOnly(b.appointment_date));

  const healthRecordCounts = {
    bloodPressure: 0,
    bloodSugar: 0,
    weight: 0,
    other: 0,
  };

  for (const record of weekHealthRecords) {
    if (record.record_type === 'blood_pressure') healthRecordCounts.bloodPressure += 1;
    else if (record.record_type === 'blood_sugar') healthRecordCounts.bloodSugar += 1;
    else if (record.record_type === 'weight') healthRecordCounts.weight += 1;
    else healthRecordCounts.other += 1;
  }

  const nextAppointmentDate = parseDateOnly(upcomingAppointments[0]?.appointment_date);
  const nextAppointmentInDays = nextAppointmentDate
    ? Math.round((nextAppointmentDate - end) / DAY_MS)
    : null;

  const facts = {
    periodStart: toDateKey(start),
    periodEnd: toDateKey(end),
    recordedTakenCount: countBy(weekLogs, (log) => log.status === 'taken'),
    recordedSkippedCount: countBy(weekLogs, (log) => log.status === 'skipped'),
    activeMedicationCount: activeMedications.length,
    lowStockMedicationCount: countBy(
      activeMedications,
      (medication) => Number(medication.stock_quantity || 0) <= Number(medication.low_stock_threshold || 0)
    ),
    healthRecordCounts,
    hasUpcomingAppointment: upcomingAppointments.length > 0,
    nextAppointmentInDays,
    dataGapCodes: [],
    evidence: {},
  };

  if (facts.activeMedicationCount === 0) facts.dataGapCodes.push('no_active_medications');
  if (facts.recordedTakenCount + facts.recordedSkippedCount === 0) facts.dataGapCodes.push('no_recorded_checkins');
  if (weekHealthRecords.length === 0) facts.dataGapCodes.push('no_health_records');
  if (!facts.hasUpcomingAppointment) facts.dataGapCodes.push('no_upcoming_appointments');

  facts.evidence = buildEvidence(facts);
  return facts;
}

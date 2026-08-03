import { getLocalWeekRange, localDateTimeBoundary } from '@/lib/dateTime';

const DAY_MS = 24 * 60 * 60 * 1000;

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

const isDateKeyInRange = (dateKey, startDate, endDate) => {
  if (!dateKey) return false;
  return dateKey >= startDate && dateKey <= endDate;
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
  const range = getLocalWeekRange(now);
  const end = parseDateOnly(range.weekEndDate);
  const upcomingEnd = parseDateOnly(range.appointmentEndDate);
  const weekStartDateTime = new Date(localDateTimeBoundary(range.weekStartDate, 'start'));
  const weekEndDateTime = new Date(localDateTimeBoundary(range.weekEndDate, 'end'));

  const medications = sourceData.medications || [];
  const medicationLogs = sourceData.medicationLogs || [];
  const healthRecords = sourceData.healthRecords || [];
  const appointments = sourceData.appointments || [];

  const activeMedications = medications.filter(
    (medication) => isNotDeleted(medication) && medication.status === 'active'
  );
  const weekLogs = medicationLogs.filter((log) =>
    isNotDeleted(log) && isDateKeyInRange(String(log.scheduled_date).slice(0, 10), range.weekStartDate, range.weekEndDate)
  );
  const weekHealthRecords = healthRecords.filter((record) =>
    isNotDeleted(record) && isDateInRange(new Date(record.recorded_at), weekStartDateTime, weekEndDateTime)
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
    periodStart: range.weekStartDate,
    periodEnd: range.weekEndDate,
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

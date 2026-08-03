import { getLocalWeekRange, localDateTimeBoundary } from '@/lib/dateTime';

const rangeFor = (now) => {
  const range = getLocalWeekRange(now);

  return {
    ...range,
    weekStartIso: localDateTimeBoundary(range.weekStartDate, 'start'),
    weekEndIso: localDateTimeBoundary(range.weekEndDate, 'end'),
  };
};

const unwrap = (result, label) => {
  if (result.error) {
    throw new Error(result.error.message || `${label} query failed`);
  }
  return result.data || [];
};

export async function loadWeeklySourceData({ client, userId, now = new Date() }) {
  if (!client) throw new Error('Supabase client is required');
  if (!userId) throw new Error('User id is required');

  const range = rangeFor(now);

  const medications = await client
    .from('medications')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const medicationLogs = await client
    .from('medication_logs')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('scheduled_date', range.weekStartDate)
    .lte('scheduled_date', range.weekEndDate)
    .order('scheduled_date', { ascending: false });

  const healthRecords = await client
    .from('health_records')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('recorded_at', range.weekStartIso)
    .lte('recorded_at', range.weekEndIso)
    .order('recorded_at', { ascending: false });

  const appointments = await client
    .from('appointments')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .eq('status', 'scheduled')
    .gte('appointment_date', range.todayDate)
    .lte('appointment_date', range.appointmentEndDate)
    .order('appointment_date', { ascending: true });

  return {
    medications: unwrap(medications, 'medications'),
    medicationLogs: unwrap(medicationLogs, 'medication logs'),
    healthRecords: unwrap(healthRecords, 'health records'),
    appointments: unwrap(appointments, 'appointments'),
  };
}

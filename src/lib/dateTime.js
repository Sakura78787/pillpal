const DAY_MS = 24 * 60 * 60 * 1000;

const pad2 = (value) => String(value).padStart(2, '0');

export function toLocalDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function normalizeTimeKey(value) {
  if (!value) return null;
  const [hour = '', minute = ''] = String(value).split(':');
  if (hour === '' || minute === '') return String(value);
  return `${pad2(Number(hour))}:${pad2(Number(minute))}`;
}

export function scheduleKeyMatches(log, { medicationId, scheduledDate, scheduledTime }) {
  if (!log) return false;
  return (
    String(log.medication_id) === String(medicationId) &&
    log.scheduled_date === scheduledDate &&
    normalizeTimeKey(log.scheduled_time) === normalizeTimeKey(scheduledTime)
  );
}

export function getLocalWeekRange(now = new Date()) {
  const end = now instanceof Date ? now : new Date(now);
  const weekEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const weekStart = new Date(weekEnd.getTime() - 6 * DAY_MS);
  const appointmentEnd = new Date(weekEnd.getTime() + 14 * DAY_MS);

  return {
    weekStartDate: toLocalDateKey(weekStart),
    weekEndDate: toLocalDateKey(weekEnd),
    todayDate: toLocalDateKey(weekEnd),
    appointmentEndDate: toLocalDateKey(appointmentEnd),
  };
}

export function localDateTimeBoundary(dateKey, boundary = 'start') {
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date =
    boundary === 'end'
      ? new Date(year, month - 1, day, 23, 59, 59, 999)
      : new Date(year, month - 1, day, 0, 0, 0, 0);
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  const offset = `${sign}${pad2(Math.floor(absoluteOffset / 60))}:${pad2(absoluteOffset % 60)}`;

  return `${toLocalDateKey(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(
    date.getSeconds()
  )}.${String(date.getMilliseconds()).padStart(3, '0')}${offset}`;
}

export function normalizeScheduledLog(log) {
  if (!log) return log;
  return {
    ...log,
    scheduled_time: normalizeTimeKey(log.scheduled_time),
  };
}

export function normalizeScheduledLogs(logs = []) {
  return logs.map(normalizeScheduledLog);
}

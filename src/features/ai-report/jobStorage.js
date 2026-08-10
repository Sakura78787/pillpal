const PREFIX = 'pillpal.ai_weekly_report_job.v1.';

const defaultStorage = () => (typeof sessionStorage === 'undefined' ? null : sessionStorage);
const keyFor = (userId) => `${PREFIX}${userId}`;

export function saveWeeklyReportJobId(userId, jobId, storage = defaultStorage()) {
  if (userId && jobId && storage) storage.setItem(keyFor(userId), jobId);
}

export function getWeeklyReportJobId(userId, storage = defaultStorage()) {
  return userId && storage ? storage.getItem(keyFor(userId)) : null;
}

export function clearWeeklyReportJob(userId, storage = defaultStorage()) {
  if (userId && storage) storage.removeItem(keyFor(userId));
}

export function clearAllWeeklyReportJobs(storage = defaultStorage()) {
  if (!storage) return;
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(PREFIX)) keys.push(key);
  }
  keys.forEach((key) => storage.removeItem(key));
}

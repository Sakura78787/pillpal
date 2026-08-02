export function isWeeklyReportEnabled(env = import.meta.env) {
  return env?.VITE_AI_WEEKLY_REPORT_ENABLED === 'true';
}

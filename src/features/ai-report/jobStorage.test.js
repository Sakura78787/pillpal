import { describe, expect, test } from 'vitest';
import { clearAllWeeklyReportJobs, clearWeeklyReportJob, getWeeklyReportJobId, saveWeeklyReportJobId } from './jobStorage.js';

const memoryStorage = () => {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
};

describe('weekly report job storage', () => {
  test('stores and restores a job id per user', () => {
    const storage = memoryStorage();
    saveWeeklyReportJobId('user-1', 'job-1', storage);
    saveWeeklyReportJobId('user-2', 'job-2', storage);
    expect(getWeeklyReportJobId('user-1', storage)).toBe('job-1');
    expect(getWeeklyReportJobId('user-2', storage)).toBe('job-2');
  });

  test('clears one user or every PillPal weekly report job on logout', () => {
    const storage = memoryStorage();
    storage.setItem('unrelated', 'keep');
    saveWeeklyReportJobId('user-1', 'job-1', storage);
    clearWeeklyReportJob('user-1', storage);
    expect(getWeeklyReportJobId('user-1', storage)).toBeNull();
    saveWeeklyReportJobId('user-1', 'job-1', storage);
    saveWeeklyReportJobId('user-2', 'job-2', storage);
    clearAllWeeklyReportJobs(storage);
    expect(getWeeklyReportJobId('user-1', storage)).toBeNull();
    expect(getWeeklyReportJobId('user-2', storage)).toBeNull();
    expect(storage.getItem('unrelated')).toBe('keep');
  });
});

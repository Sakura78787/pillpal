import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const root = resolve(import.meta.dirname, '../..');

describe('async weekly report deployment contract', () => {
  test('uses a Netlify background-function filename and background config', () => {
    const backgroundPath = resolve(root, 'netlify/functions/process-weekly-report-background.ts');

    expect(existsSync(backgroundPath)).toBe(true);
    expect(existsSync(resolve(root, 'netlify/functions/process-weekly-report.ts'))).toBe(false);
    expect(readFileSync(backgroundPath, 'utf8')).toMatch(/background:\s*true/);
  });

  test('migration locks the job table behind the service role', () => {
    const sql = readFileSync(
      resolve(root, 'supabase/migrations/20260810000000_ai_weekly_report_jobs.sql'),
      'utf8',
    );

    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/revoke all on public\.ai_weekly_report_jobs from public, anon, authenticated/i);
    expect(sql).toMatch(/grant select, insert, update, delete on public\.ai_weekly_report_jobs to service_role/i);
    expect(sql).toMatch(/where status in \('queued', 'running'\)/i);
    expect(sql).not.toMatch(/\b(prompt|facts|health_values|access_token)\s+(jsonb|text)/i);
  });
});

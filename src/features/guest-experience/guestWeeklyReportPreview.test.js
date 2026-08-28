import { describe, expect, test } from 'vitest';
import { weeklyReportV2Schema } from '@/features/ai-report/contracts.js';
import { guestWeeklyReportPreview, guestWeeklyReportPreviewFacts } from './guestWeeklyReportPreview.js';

describe('guest weekly report preview', () => {
  test('is a valid fixed V2 sample whose evidence can all be resolved', () => {
    expect(weeklyReportV2Schema.safeParse(guestWeeklyReportPreview).success).toBe(true);
    const evidenceIds = [
      ...guestWeeklyReportPreview.adherence.evidence_ids,
      ...guestWeeklyReportPreview.insights.flatMap((item) => item.evidence_ids),
      ...guestWeeklyReportPreview.actions.flatMap((item) => item.evidence_ids),
    ];
    expect(evidenceIds.every((id) => id in guestWeeklyReportPreviewFacts.evidence)).toBe(true);
  });
});

import type { z } from 'zod';
import type { weeklyFactsSchema } from '../../../src/features/ai-report/contracts.js';

type WeeklyFacts = z.infer<typeof weeklyFactsSchema>;

export const FIXED_WEEKLY_REPORT_DISCLAIMER =
  '本周报仅整理你已记录的信息，不构成诊断、处方或用药调整建议。';

const schemaInstruction = `
Return one JSON object only:
{
  "summary": "string",
  "highlights": [{"type": "string", "text": "string", "evidence_ids": ["string"]}],
  "data_gaps": ["string"],
  "disclaimer": "${FIXED_WEEKLY_REPORT_DISCLAIMER}",
  "meta": {"promptVersion": "v0 or v1", "model": "model id"}
}
`;

export function buildWeeklyReportMessages({
  facts,
  promptVersion,
  model,
}: {
  facts: WeeklyFacts;
  promptVersion: 'v0' | 'v1';
  model: string;
}) {
  const factsJson = JSON.stringify(facts);
  const baseSystem = [
    'You generate a weekly medication-management summary for a consumer health app.',
    'Use only the provided anonymous aggregate facts.',
    'Do not diagnose, prescribe, change dosage, promise outcomes, or infer disease status.',
    'Do not mention adherence rate because planned-dose events are incomplete.',
    'Numbers must come from the provided facts only.',
    schemaInstruction,
  ].join('\n');

  const v1Additions = [
    'For every highlight, include at least one evidence_ids item that exists in facts.evidence.',
    'Prefer concrete recorded check-in counts, low-stock count, health-record count, upcoming appointment status, and data gaps.',
    'When data is sparse, say the record is insufficient instead of describing health control as good or bad.',
    'Keep the tone neutral, short, and non-medical.',
  ].join('\n');

  return [
    {
      role: 'system',
      content: promptVersion === 'v1' ? `${baseSystem}\n${v1Additions}` : baseSystem,
    },
    {
      role: 'user',
      content: JSON.stringify({ facts: factsJson, promptVersion, model }),
    },
  ];
}

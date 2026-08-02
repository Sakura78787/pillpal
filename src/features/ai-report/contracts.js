import { z } from 'zod';

export const evidenceValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const weeklyFactsSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  recordedTakenCount: z.number().int().nonnegative(),
  recordedSkippedCount: z.number().int().nonnegative(),
  activeMedicationCount: z.number().int().nonnegative(),
  lowStockMedicationCount: z.number().int().nonnegative(),
  healthRecordCounts: z.object({
    bloodPressure: z.number().int().nonnegative(),
    bloodSugar: z.number().int().nonnegative(),
    weight: z.number().int().nonnegative(),
    other: z.number().int().nonnegative(),
  }),
  hasUpcomingAppointment: z.boolean(),
  nextAppointmentInDays: z.number().int().nonnegative().nullable(),
  dataGapCodes: z.array(z.string()),
  evidence: z.record(evidenceValueSchema),
});

export const weeklyReportRequestSchema = z.object({
  facts: weeklyFactsSchema,
  promptVersion: z.enum(['v0', 'v1']).optional(),
});

export const weeklyReportSchema = z.object({
  summary: z.string().min(1),
  highlights: z.array(
    z.object({
      type: z.string().min(1),
      text: z.string().min(1),
      evidence_ids: z.array(z.string().min(1)).min(1),
    })
  ),
  data_gaps: z.array(z.string()),
  disclaimer: z.literal('本周报仅整理你已记录的信息，不构成诊断、处方或用药调整建议。'),
  meta: z.object({
    promptVersion: z.enum(['v0', 'v1']),
    model: z.string().min(1),
  }),
});

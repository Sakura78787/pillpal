import { z } from 'zod';

export const FIXED_WEEKLY_REPORT_DISCLAIMER =
  '本周报仅整理你已记录的信息，不构成诊断、处方或用药调整建议。';

export const evidenceValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const weeklyFactsV1Schema = z.object({
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

const doseSlotSchema = z.object({
  due: z.number().int().nonnegative(),
  taken: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  unrecorded: z.number().int().nonnegative(),
});

const trendSchema = z.object({
  count: z.number().int().nonnegative(),
  earliest: z.number().nullable(),
  latest: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  delta: z.number().nullable(),
  trendSufficient: z.boolean(),
});

const healthFactsSchema = z.object({
  totalCounts: z.object({ bloodPressure: z.number().int().nonnegative(), bloodSugar: z.number().int().nonnegative(), weight: z.number().int().nonnegative() }),
  sentCounts: z.object({ bloodPressure: z.number().int().nonnegative(), bloodSugar: z.number().int().nonnegative(), weight: z.number().int().nonnegative() }),
  invalidRecordCount: z.number().int().nonnegative(),
  samples: z.object({
    bloodPressure: z.array(z.object({ recordedAt: z.string(), systolic: z.number().positive(), diastolic: z.number().positive(), heartRate: z.number().positive().optional() })).max(14),
    bloodSugar: z.array(z.object({ recordedAt: z.string(), value: z.number().positive(), timing: z.enum(['fasting', 'post_meal', 'random']) })).max(14),
    weight: z.array(z.object({ recordedAt: z.string(), value: z.number().positive(), bmi: z.number().positive().optional() })).max(14),
  }),
  trends: z.object({
    bloodPressure: z.object({ systolic: trendSchema, diastolic: trendSchema, heartRate: trendSchema }),
    bloodSugar: z.object({ fasting: trendSchema, postMeal: trendSchema, random: trendSchema }),
    weight: trendSchema,
  }),
  dataGapCodes: z.array(z.string()),
});

export const weeklyFactsV2Schema = weeklyFactsV1Schema.extend({
  dueDoseCount: z.number().int().nonnegative(),
  takenDoseCount: z.number().int().nonnegative(),
  skippedDoseCount: z.number().int().nonnegative(),
  unrecordedDoseCount: z.number().int().nonnegative(),
  recordedTakenRate: z.number().min(0).max(1).nullable(),
  statusCoverageRate: z.number().min(0).max(1).nullable(),
  excludedCustomMedicationCount: z.number().int().nonnegative(),
  unmatchedLogCount: z.number().int().nonnegative(),
  conflictingLogCount: z.number().int().nonnegative(),
  timeSlotStats: z.object({ morning: doseSlotSchema, midday: doseSlotSchema, evening: doseSlotSchema, other: doseSlotSchema }),
  mostUnrecordedTimeSlot: z.enum(['morning', 'midday', 'evening', 'other']).nullable(),
  affectedDateCount: z.number().int().nonnegative(),
  maxConsecutiveUnrecordedDays: z.number().int().nonnegative(),
  medicationSummaries: z.array(z.object({
    ref: z.string().regex(/^med_\d+$/),
    due: z.number().int().nonnegative(),
    taken: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    unrecorded: z.number().int().nonnegative(),
    recordedTakenRate: z.number().min(0).max(1).nullable(),
    estimatedStockDays: z.number().int().nonnegative().nullable(),
  })),
  customRecordedCount: z.number().int().nonnegative(),
  feelingScoreCount: z.number().int().nonnegative(),
  lowFeelingScoreCount: z.number().int().nonnegative(),
  skipReasonCounts: z.record(z.number().int().nonnegative()),
  health: healthFactsSchema,
});

export const weeklyFactsSchema = z.union([weeklyFactsV2Schema, weeklyFactsV1Schema]);

export const weeklyReportRequestSchema = z.object({
  facts: weeklyFactsSchema,
  promptVersion: z.enum(['v0', 'v1', 'v2']).optional(),
});

export const weeklyReportV1Schema = z.object({
  summary: z.string().min(1),
  highlights: z.array(z.object({ type: z.string().min(1), text: z.string().min(1), evidence_ids: z.array(z.string().min(1)).min(1) })),
  data_gaps: z.array(z.string()),
  disclaimer: z.literal(FIXED_WEEKLY_REPORT_DISCLAIMER),
  meta: z.object({ promptVersion: z.enum(['v0', 'v1']), model: z.string().min(1) }),
});

export const actionCodeSchema = z.enum([
  'confirm_unrecorded_schedule',
  'review_skipped_reason',
  'check_stock',
  'prepare_follow_up',
  'continue_health_tracking',
  'review_health_trend',
]);

export const weeklyReportV2Schema = z.object({
  summary: z.string().min(1),
  adherence: z.object({ headline: z.string().min(1), interpretation: z.string().min(1), evidence_ids: z.array(z.string().min(1)).min(1) }),
  insights: z.array(z.object({
    category: z.enum(['adherence', 'time_pattern', 'stock', 'health', 'appointment', 'data_quality']),
    severity: z.enum(['info', 'attention', 'action']),
    title: z.string().min(1),
    detail: z.string().min(1),
    evidence_ids: z.array(z.string().min(1)).min(1),
    related_medication_refs: z.array(z.string().regex(/^med_\d+$/)),
  })).max(3),
  health_trends: z.array(z.object({ metric: z.enum(['blood_pressure', 'blood_sugar', 'weight']), summary: z.string().min(1), evidence_ids: z.array(z.string().min(1)).min(1) })).max(3),
  actions: z.array(z.object({
    action_code: actionCodeSchema,
    text: z.string().min(1),
    reason: z.string().min(1),
    evidence_ids: z.array(z.string().min(1)).min(1),
    related_medication_refs: z.array(z.string().regex(/^med_\d+$/)),
  })).max(3),
  data_gaps: z.array(z.object({ code: z.string().min(1), text: z.string().min(1) })),
  disclaimer: z.literal(FIXED_WEEKLY_REPORT_DISCLAIMER),
  meta: z.object({ promptVersion: z.literal('v2'), model: z.string().min(1) }),
});

export const weeklyReportSchema = z.union([weeklyReportV2Schema, weeklyReportV1Schema]);

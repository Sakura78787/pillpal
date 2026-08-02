import type { Config, Context } from '@netlify/functions';
import { weeklyReportRequestSchema, weeklyReportSchema } from '../../src/features/ai-report/contracts.js';
import { getWeeklyReportConfig, type WeeklyReportFunctionConfig } from './_shared/weeklyReportConfig.ts';
import {
  FIXED_WEEKLY_REPORT_DISCLAIMER,
  buildWeeklyReportMessages,
} from './_shared/weeklyReportPrompts.ts';
import { verifySupabaseUser } from './_shared/verifySupabaseUser.ts';

type PromptVersion = 'v0' | 'v1';

type HandlerDeps = {
  getConfig: () => WeeklyReportFunctionConfig;
  verifyUser: (accessToken: string) => Promise<unknown>;
  callModel: (input: { facts: unknown; promptVersion: PromptVersion }, config: WeeklyReportFunctionConfig) => Promise<unknown>;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const extractBearerToken = (request: Request) => {
  const value = request.headers.get('authorization') || '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || '';
};

const isRecoverableQwenError = (value: unknown) => {
  const text = JSON.stringify(value);
  return /AllocationQuota\.FreeTierOnly|quota|rate.?limit|429/i.test(text);
};

const validateEvidenceIds = (report: unknown, facts: Record<string, unknown>) => {
  const parsed = weeklyReportSchema.parse(report);
  const validIds = new Set(Object.keys(facts.evidence as Record<string, unknown>));
  for (const highlight of parsed.highlights) {
    for (const evidenceId of highlight.evidence_ids) {
      if (!validIds.has(evidenceId)) {
        throw new Error(`Invalid evidence id: ${evidenceId}`);
      }
    }
  }
  return {
    ...parsed,
    disclaimer: FIXED_WEEKLY_REPORT_DISCLAIMER,
  };
};

export async function callQwenWeeklyReport(
  input: { facts: unknown; promptVersion: PromptVersion },
  config: WeeklyReportFunctionConfig
) {
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: buildWeeklyReportMessages({
        facts: input.facts as never,
        promptVersion: input.promptVersion,
        model: config.model,
      }),
      temperature: 0.2,
      response_format: { type: 'json_object' },
      extra_body: { enable_thinking: false },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return payload;

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') return payload;
  return JSON.parse(content);
}

export async function handleWeeklyReportRequest(request: Request, deps: HandlerDeps) {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const config = deps.getConfig();
  if (!config.enabled) {
    return json({ error: 'AI weekly report is temporarily unavailable' }, 503);
  }
  if (!config.apiKey) {
    return json({ error: 'AI weekly report is temporarily unavailable' }, 503);
  }

  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    await deps.verifyUser(accessToken);
  } catch {
    return json({ error: 'Unauthorized' }, 401);
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    return json({ error: 'Invalid JSON payload' }, 400);
  }

  const parsedRequest = weeklyReportRequestSchema.safeParse(requestBody);
  if (!parsedRequest.success) {
    return json({ error: 'Invalid weekly report facts' }, 400);
  }

  const promptVersion = parsedRequest.data.promptVersion || 'v1';
  if (promptVersion === 'v0' && !config.evalMode) {
    return json({ error: 'Prompt V0 is only available in evaluation mode' }, 403);
  }

  try {
    const modelResult = await deps.callModel(
      { facts: parsedRequest.data.facts, promptVersion },
      config
    );
    if (isRecoverableQwenError(modelResult)) {
      return json({ error: 'AI weekly report is temporarily unavailable' }, 503);
    }
    const report = validateEvidenceIds(modelResult, parsedRequest.data.facts);
    return json({ report });
  } catch {
    return json({ error: 'AI weekly report generation failed' }, 502);
  }
}

export default async (request: Request, _context: Context) => {
  return handleWeeklyReportRequest(request, {
    getConfig: getWeeklyReportConfig,
    verifyUser: verifySupabaseUser,
    callModel: callQwenWeeklyReport,
  });
};

export const config: Config = {
  path: '/api/ai/weekly-report',
  rateLimit: {
    windowLimit: 10,
    windowSize: 60,
    aggregateBy: ['ip', 'domain'],
  },
};

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type WeeklyReportJobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type WeeklyReportJob = {
  id: string;
  user_id: string;
  status: WeeklyReportJobStatus;
  prompt_version: 'v2';
  model: string;
  report: unknown | null;
  error_code: string | null;
  diagnostic: string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  model_duration_ms?: number | null;
  attempt_count?: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string;
};

export type WeeklyReportJobRepository = {
  deleteExpired(now: Date): Promise<void>;
  findActive(userId: string): Promise<WeeklyReportJob | null>;
  create(input: { userId: string; promptVersion: 'v2'; model: string; now: Date }): Promise<WeeklyReportJob>;
  findOwned(jobId: string, userId: string): Promise<WeeklyReportJob | null>;
  claim(jobId: string, userId: string, now: Date): Promise<WeeklyReportJob | null>;
  complete(jobId: string, userId: string, input: { report: unknown; inputTokens: number; outputTokens: number; modelDurationMs: number; now: Date }): Promise<void>;
  markFailed(jobId: string, userId: string, input: {
    errorCode: string;
    diagnostic: string;
    inputTokens?: number;
    outputTokens?: number;
    modelDurationMs?: number;
    now?: Date;
  }): Promise<void>;
};

const throwIfError = (error: unknown) => {
  if (error) throw error;
};

export function createWeeklyReportJobRepository(client: SupabaseClient): WeeklyReportJobRepository {
  return {
    async deleteExpired(now) {
      const { error } = await client.from('ai_weekly_report_jobs').delete().lt('expires_at', now.toISOString());
      throwIfError(error);
    },

    async findActive(userId) {
      const { data, error } = await client
        .from('ai_weekly_report_jobs')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['queued', 'running'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      throwIfError(error);
      return data as WeeklyReportJob | null;
    },

    async create({ userId, promptVersion, model, now }) {
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const { data, error } = await client
        .from('ai_weekly_report_jobs')
        .insert({ user_id: userId, status: 'queued', prompt_version: promptVersion, model, expires_at: expiresAt.toISOString() })
        .select('*')
        .single();
      throwIfError(error);
      return data as WeeklyReportJob;
    },

    async findOwned(jobId, userId) {
      const { data, error } = await client
        .from('ai_weekly_report_jobs')
        .select('*')
        .eq('id', jobId)
        .eq('user_id', userId)
        .maybeSingle();
      throwIfError(error);
      return data as WeeklyReportJob | null;
    },

    async claim(jobId, userId, now) {
      const timestamp = now.toISOString();
      const { data, error } = await client
        .from('ai_weekly_report_jobs')
        .update({ status: 'running', started_at: timestamp, updated_at: timestamp, attempt_count: 1 })
        .eq('id', jobId)
        .eq('user_id', userId)
        .eq('status', 'queued')
        .select('*')
        .maybeSingle();
      throwIfError(error);
      return data as WeeklyReportJob | null;
    },

    async complete(jobId, userId, { report, inputTokens, outputTokens, modelDurationMs, now }) {
      const timestamp = now.toISOString();
      const { data, error } = await client
        .from('ai_weekly_report_jobs')
        .update({
          status: 'succeeded', report, error_code: null, diagnostic: null,
          input_tokens: inputTokens, output_tokens: outputTokens, model_duration_ms: modelDurationMs,
          completed_at: timestamp, updated_at: timestamp,
        })
        .eq('id', jobId)
        .eq('user_id', userId)
        .eq('status', 'running')
        .select('id')
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error('Weekly report job update matched no rows');
    },

    async markFailed(jobId, userId, { errorCode, diagnostic, inputTokens, outputTokens, modelDurationMs, now = new Date() }) {
      const timestamp = now.toISOString();
      const { data, error } = await client
        .from('ai_weekly_report_jobs')
        .update({
          status: 'failed', report: null, error_code: errorCode, diagnostic,
          ...(inputTokens !== undefined ? { input_tokens: inputTokens } : {}),
          ...(outputTokens !== undefined ? { output_tokens: outputTokens } : {}),
          ...(modelDurationMs !== undefined ? { model_duration_ms: modelDurationMs } : {}),
          completed_at: timestamp, updated_at: timestamp,
        })
        .eq('id', jobId)
        .eq('user_id', userId)
        .in('status', ['queued', 'running'])
        .select('id')
        .maybeSingle();
      throwIfError(error);
      if (!data) throw new Error('Weekly report job update matched no rows');
    },
  };
}

export function createWeeklyReportAdminClient(url: string, secretKey: string) {
  if (!url || !secretKey) throw new Error('Missing Supabase server configuration');
  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

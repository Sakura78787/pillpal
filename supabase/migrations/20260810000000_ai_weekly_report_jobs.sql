create table public.ai_weekly_report_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'succeeded', 'failed')),
  prompt_version text not null default 'v2' check (prompt_version = 'v2'),
  model text not null,
  report jsonb,
  error_code text,
  diagnostic text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  model_duration_ms integer check (model_duration_ms is null or model_duration_ms >= 0),
  attempt_count integer not null default 0 check (attempt_count between 0 and 1),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint ai_weekly_report_jobs_result_state check (
    (status = 'succeeded' and report is not null and error_code is null)
    or (status = 'failed' and report is null and error_code is not null)
    or (status in ('queued', 'running') and report is null and error_code is null)
  )
);

create index ai_weekly_report_jobs_user_created_idx
  on public.ai_weekly_report_jobs (user_id, created_at desc);

create index ai_weekly_report_jobs_expires_idx
  on public.ai_weekly_report_jobs (expires_at);

create unique index ai_weekly_report_jobs_one_active_per_user_idx
  on public.ai_weekly_report_jobs (user_id)
  where status in ('queued', 'running');

create trigger ai_weekly_report_jobs_set_updated_at
before update on public.ai_weekly_report_jobs
for each row execute function public.set_updated_at();

alter table public.ai_weekly_report_jobs enable row level security;

revoke all on public.ai_weekly_report_jobs from public, anon, authenticated;
grant select, insert, update, delete on public.ai_weekly_report_jobs to service_role;

create table public.care_authorizations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  caregiver_user_id uuid references auth.users(id) on delete cascade,
  caregiver_email_normalized text not null,
  owner_label text not null default '家人',
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint care_authorizations_email_normalized check (caregiver_email_normalized = lower(trim(caregiver_email_normalized)))
);

create unique index care_authorizations_owner_email_active_idx
  on public.care_authorizations (owner_user_id, caregiver_email_normalized)
  where status in ('pending', 'active');
create index care_authorizations_caregiver_active_idx
  on public.care_authorizations (caregiver_user_id)
  where status = 'active';
create index care_authorizations_owner_idx on public.care_authorizations (owner_user_id);

create trigger care_authorizations_set_updated_at
before update on public.care_authorizations
for each row execute function public.set_updated_at();

alter table public.care_authorizations enable row level security;
revoke all on public.care_authorizations from public, anon, authenticated;
grant select on public.care_authorizations to authenticated;

create policy "care_authorizations_select_owner_or_caregiver"
on public.care_authorizations for select
to authenticated
using (
  owner_user_id = (select auth.uid())
  or caregiver_user_id = (select auth.uid())
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  care_authorization_id uuid references public.care_authorizations(id) on delete set null,
  type text not null check (type in ('low_stock', 'appointment_soon', 'record_pending', 'caregiver_medication_reminder')),
  dedupe_key text not null,
  title text not null,
  body text not null,
  link text not null default '/dashboard',
  read_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_link_is_relative check (link like '/%')
);

create unique index notifications_recipient_dedupe_idx
  on public.notifications (recipient_user_id, dedupe_key);
create index notifications_recipient_unread_idx
  on public.notifications (recipient_user_id, read_at, created_at desc);

create trigger notifications_set_updated_at
before update on public.notifications
for each row execute function public.set_updated_at();

alter table public.notifications enable row level security;
revoke all on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;

create policy "notifications_select_recipient"
on public.notifications for select
to authenticated
using (recipient_user_id = (select auth.uid()));

alter table public.ai_weekly_report_jobs
  add column subject_user_id uuid references auth.users(id) on delete cascade;
update public.ai_weekly_report_jobs set subject_user_id = user_id where subject_user_id is null;

-- Keep the existing deployed AI function working while this migration is live:
-- older code does not yet send subject_user_id, so its report subject remains
-- the requester. The new function sends an explicit value for care reports.
create function public.fill_ai_weekly_report_job_subject_user_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.subject_user_id is null then
    new.subject_user_id := new.user_id;
  end if;
  return new;
end;
$$;

revoke execute on function public.fill_ai_weekly_report_job_subject_user_id() from public, anon, authenticated;

create trigger ai_weekly_report_jobs_fill_subject_user_id
before insert on public.ai_weekly_report_jobs
for each row execute function public.fill_ai_weekly_report_job_subject_user_id();

alter table public.ai_weekly_report_jobs alter column subject_user_id set not null;
create index ai_weekly_report_jobs_subject_created_idx
  on public.ai_weekly_report_jobs (subject_user_id, created_at desc);
drop index if exists ai_weekly_report_jobs_one_active_per_user_idx;
create unique index ai_weekly_report_jobs_one_active_per_requester_subject_idx
  on public.ai_weekly_report_jobs (user_id, subject_user_id)
  where status in ('queued', 'running');

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

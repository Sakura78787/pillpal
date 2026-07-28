create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  username text not null default '',
  phone text not null default '',
  avatar_url text not null default '',
  chronic_diseases jsonb not null default '[]'::jsonb,
  emergency_contact jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{"font_size":"standard","theme":"light","reminder_enabled":true}'::jsonb,
  account_type text not null default 'primary' check (account_type in ('primary', 'sub', 'viewer')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.medications (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  dosage text not null default '',
  unit text not null default '片',
  frequency_type text not null default 'daily' check (frequency_type in ('daily', 'weekly', 'interval', 'custom')),
  frequency_config jsonb not null default '{}'::jsonb,
  meal_timing text not null default 'anytime' check (meal_timing in ('before_meal', 'after_meal', 'with_meal', 'anytime')),
  reminder_times text[] not null default array['08:00'],
  start_date date not null default current_date,
  end_date date,
  stock_quantity numeric not null default 0,
  stock_unit text not null default '片',
  low_stock_threshold numeric not null default 7,
  status text not null default 'active' check (status in ('active', 'paused', 'deleted')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint medications_stock_nonnegative check (stock_quantity >= 0),
  constraint medications_threshold_nonnegative check (low_stock_threshold >= 0)
);

create table if not exists public.medication_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  medication_id bigint not null references public.medications(id) on delete cascade,
  scheduled_date date not null,
  scheduled_time time not null,
  taken_at timestamptz,
  status text not null check (status in ('taken', 'skipped')),
  skip_reason text,
  feeling_score int check (feeling_score is null or feeling_score between 1 and 5),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.health_records (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  record_type text not null check (record_type in ('blood_pressure', 'blood_sugar', 'weight')),
  values jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.appointments (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  hospital_name text not null,
  department text not null,
  doctor_name text not null default '',
  appointment_date date not null,
  appointment_time time,
  is_first_visit boolean not null default false,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  checkup_items text[] not null default '{}',
  prescription jsonb not null default '{}'::jsonb,
  reminder_days int not null default 3 check (reminder_days between 0 and 30),
  notes text not null default '',
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists profiles_user_id_idx on public.profiles(user_id);
create index if not exists medications_user_status_idx on public.medications(user_id, status);
create index if not exists medication_logs_user_date_idx on public.medication_logs(user_id, scheduled_date);
create index if not exists medication_logs_medication_idx on public.medication_logs(medication_id);
create unique index if not exists medication_logs_unique_taken_time_idx
  on public.medication_logs(user_id, medication_id, scheduled_date, scheduled_time)
  where deleted_at is null and status = 'taken';
create index if not exists health_records_user_recorded_idx on public.health_records(user_id, recorded_at desc);
create index if not exists appointments_user_date_idx on public.appointments(user_id, appointment_date desc);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists medications_set_updated_at on public.medications;
create trigger medications_set_updated_at
before update on public.medications
for each row execute function public.set_updated_at();

drop trigger if exists medication_logs_set_updated_at on public.medication_logs;
create trigger medication_logs_set_updated_at
before update on public.medication_logs
for each row execute function public.set_updated_at();

drop trigger if exists health_records_set_updated_at on public.health_records;
create trigger health_records_set_updated_at
before update on public.health_records
for each row execute function public.set_updated_at();

drop trigger if exists appointments_set_updated_at on public.appointments;
create trigger appointments_set_updated_at
before update on public.appointments
for each row execute function public.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into public.profiles (user_id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.medications,
  public.medication_logs,
  public.health_records,
  public.appointments
to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter table public.profiles enable row level security;
alter table public.medications enable row level security;
alter table public.medication_logs enable row level security;
alter table public.health_records enable row level security;
alter table public.appointments enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own"
on public.profiles for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "medications_select_own" on public.medications;
create policy "medications_select_own"
on public.medications for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "medications_insert_own" on public.medications;
create policy "medications_insert_own"
on public.medications for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "medications_update_own" on public.medications;
create policy "medications_update_own"
on public.medications for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "medications_delete_own" on public.medications;
create policy "medications_delete_own"
on public.medications for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "medication_logs_select_own" on public.medication_logs;
create policy "medication_logs_select_own"
on public.medication_logs for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "medication_logs_insert_own" on public.medication_logs;
create policy "medication_logs_insert_own"
on public.medication_logs for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.medications
    where medications.id = medication_logs.medication_id
      and medications.user_id = (select auth.uid())
  )
);

drop policy if exists "medication_logs_update_own" on public.medication_logs;
create policy "medication_logs_update_own"
on public.medication_logs for update
to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.medications
    where medications.id = medication_logs.medication_id
      and medications.user_id = (select auth.uid())
  )
);

drop policy if exists "medication_logs_delete_own" on public.medication_logs;
create policy "medication_logs_delete_own"
on public.medication_logs for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "health_records_select_own" on public.health_records;
create policy "health_records_select_own"
on public.health_records for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "health_records_insert_own" on public.health_records;
create policy "health_records_insert_own"
on public.health_records for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "health_records_update_own" on public.health_records;
create policy "health_records_update_own"
on public.health_records for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "health_records_delete_own" on public.health_records;
create policy "health_records_delete_own"
on public.health_records for delete
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "appointments_select_own" on public.appointments;
create policy "appointments_select_own"
on public.appointments for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "appointments_insert_own" on public.appointments;
create policy "appointments_insert_own"
on public.appointments for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "appointments_update_own" on public.appointments;
create policy "appointments_update_own"
on public.appointments for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "appointments_delete_own" on public.appointments;
create policy "appointments_delete_own"
on public.appointments for delete
to authenticated
using ((select auth.uid()) = user_id);

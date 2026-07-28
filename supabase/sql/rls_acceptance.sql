-- Replace the UUIDs below with two real auth.users ids from your Supabase project.
-- Run this in a disposable Supabase project or development branch.

begin;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.medications (user_id, name, dosage)
values ('00000000-0000-0000-0000-000000000001', 'RLS user A medicine', '1')
returning id;

-- This should fail because the row is assigned to another user.
insert into public.medications (user_id, name, dosage)
values ('00000000-0000-0000-0000-000000000002', 'Cross user medicine', '1');

rollback;

-- Manual browser/API acceptance:
-- 1. Create two Supabase Auth users with different emails.
-- 2. Log in as user A and create medications, logs, health records, and appointments.
-- 3. Log in as user B in a different browser profile.
-- 4. Confirm user B cannot see or update user A's rows through the app or REST API.

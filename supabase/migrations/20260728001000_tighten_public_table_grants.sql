revoke all on
  public.profiles,
  public.medications,
  public.medication_logs,
  public.health_records,
  public.appointments
from anon, authenticated;

grant select, insert, update, delete on
  public.profiles,
  public.medications,
  public.medication_logs,
  public.health_records,
  public.appointments
to authenticated;

revoke all on all sequences in schema public from anon, authenticated;
grant usage, select on all sequences in schema public to authenticated;

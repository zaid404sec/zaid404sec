-- Enable Realtime for booking notification events. The app still uses per-device receipts
-- in booking-api; Realtime is an acceleration signal, not the source of truth.
do $block$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pac_booking_notification_events'
  ) then
    alter publication supabase_realtime add table public.pac_booking_notification_events;
  end if;
end;
$block$;

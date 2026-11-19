-- Covering indexes for new private booking-notification event foreign keys.
create index if not exists pac_booking_notification_events_booking_id_idx
  on public.pac_booking_notification_events(booking_id);
create index if not exists pac_booking_notification_events_communication_job_id_idx
  on public.pac_booking_notification_events(communication_job_id)
  where communication_job_id is not null;
create index if not exists pac_booking_notification_events_acknowledged_by_idx
  on public.pac_booking_notification_events(acknowledged_by)
  where acknowledged_by is not null;

-- Record which signed-in WashDesk member accepted, rejected or cancelled a booking.
alter table public.pac_bookings
  add column status_changed_by uuid references auth.users(id) on delete set null,
  add column status_changed_by_label text not null default '',
  add column status_changed_at timestamptz;

alter table public.pac_booking_notification_events
  add column actor_user_id uuid references auth.users(id) on delete set null,
  add column actor_label text not null default '';

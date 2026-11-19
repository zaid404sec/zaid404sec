-- WashDesk 2.12.1: explicit rejected booking status.
-- Existing bookings are preserved; no destructive rewrite or reseed.

alter table public.pac_bookings
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references auth.users(id);

alter table public.pac_bookings
  drop constraint if exists pac_bookings_status_check;

alter table public.pac_bookings
  add constraint pac_bookings_status_check
  check (status in ('pending','confirmed','rescheduled','cancelled','completed','no_show','rejected'));

create index if not exists pac_bookings_workspace_rejected_recent_idx
  on public.pac_bookings (workspace_id, rejected_at desc)
  where status = 'rejected';

comment on column public.pac_bookings.rejected_at is
  'Timestamp when a pending booking request was explicitly rejected by a paired WashDesk user.';
comment on column public.pac_bookings.rejected_by is
  'Authenticated WashDesk user who rejected the booking request.';

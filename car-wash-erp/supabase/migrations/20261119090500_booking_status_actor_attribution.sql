-- Track which paired device made each booking decision.
alter table public.pac_bookings
  add column if not exists confirmed_by uuid references auth.users(id) on delete set null,
  add column if not exists cancelled_by uuid references auth.users(id) on delete set null,
  add column if not exists status_changed_by uuid references auth.users(id) on delete set null,
  add column if not exists status_changed_by_label text not null default '',
  add column if not exists status_changed_at timestamptz;

-- Owner-managed five-device booking access.
-- The existing workspace membership/authentication model remains unchanged.
-- Booking alerts and booking decisions are restricted to explicitly approved device identities.

create table if not exists public.pac_booking_devices (
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null,
  device_kind text not null default 'phone'
    check (device_kind in ('phone', 'desktop', 'other')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'rejected', 'revoked')),
  can_decide_bookings boolean not null default false,
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  primary key (workspace_id, auth_user_id)
);

create index if not exists pac_booking_devices_workspace_status_idx
  on public.pac_booking_devices(workspace_id, status);

create index if not exists pac_booking_devices_workspace_decision_idx
  on public.pac_booking_devices(workspace_id, can_decide_bookings)
  where status = 'active';

alter table public.pac_booking_devices enable row level security;

-- Seed the canonical Owner as the first of five authorised devices.
insert into public.pac_booking_devices (
  workspace_id, auth_user_id, device_label, device_kind, status,
  can_decide_bookings, approved_at, approved_by, last_seen_at
)
select
  w.id, w.owner_auth_user_id, 'Owner Phone', 'phone', 'active',
  true, now(), w.owner_auth_user_id, now()
from public.washdesk_workspaces w
where w.owner_auth_user_id is not null
on conflict (workspace_id, auth_user_id) do update
set device_label = 'Owner Phone',
    device_kind = 'phone',
    status = 'active',
    can_decide_bookings = true,
    approved_at = coalesce(public.pac_booking_devices.approved_at, now()),
    approved_by = public.pac_booking_devices.approved_by,
    revoked_at = null;

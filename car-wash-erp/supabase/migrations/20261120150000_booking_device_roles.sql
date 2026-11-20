-- Prime Auto Care 2.13.4: explicit five-device notification and booking-decision access.
-- This is additive. It does not change customer, invoice, booking, attendance or workspace rows.
create table if not exists public.pac_booking_device_access (
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  device_label text not null,
  device_type text not null check (device_type in ('mobile','desktop','unknown')),
  notifications_enabled boolean not null default false,
  can_decide boolean not null default false,
  granted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (workspace_id, auth_user_id),
  constraint pac_booking_device_label_length check (char_length(device_label) between 2 and 40)
);

create index if not exists pac_booking_device_access_active_idx
  on public.pac_booking_device_access(workspace_id, last_seen_at desc)
  where revoked_at is null;

alter table public.pac_booking_device_access enable row level security;
revoke all on public.pac_booking_device_access from anon, authenticated;
grant all on public.pac_booking_device_access to service_role;

-- Preserve the canonical Owner account and register it as the first authorised device.
insert into public.pac_booking_device_access (
  workspace_id, auth_user_id, device_label, device_type,
  notifications_enabled, can_decide, granted_by, last_seen_at
)
select w.id, w.owner_auth_user_id, 'Owner Phone', 'mobile',
       true, true, w.owner_auth_user_id, now()
from public.washdesk_workspaces w
where w.business_name = 'Prime Auto Care'
on conflict (workspace_id, auth_user_id) do update
  set notifications_enabled = true,
      can_decide = true,
      revoked_at = null,
      updated_at = now(),
      last_seen_at = now();

comment on table public.pac_booking_device_access is
  'Owner-controlled device allowlist. Maximum five active devices; only Owner and one registered Manager Laptop may decide bookings.';

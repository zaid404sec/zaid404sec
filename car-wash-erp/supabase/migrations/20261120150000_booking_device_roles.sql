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

-- Serialize registrations and enforce the active-device and decision-maker limits at the database boundary.
create or replace function public.pac_enforce_booking_device_access_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner uuid;
  v_active_count integer;
  v_other_deciders integer;
  v_was_active boolean := false;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.workspace_id::text, 0));

  select owner_auth_user_id
    into v_owner
    from public.washdesk_workspaces
    where id = new.workspace_id;

  if v_owner is null then
    raise exception 'BOOKING_DEVICE_WORKSPACE_NOT_FOUND';
  end if;

  if tg_op = 'UPDATE' then
    v_was_active := old.revoked_at is null;
  end if;

  if new.revoked_at is null and (tg_op = 'INSERT' or not v_was_active) then
    select count(*)
      into v_active_count
      from public.pac_booking_device_access d
      where d.workspace_id = new.workspace_id
        and d.revoked_at is null
        and d.auth_user_id <> new.auth_user_id;

    if v_active_count >= 5 then
      raise exception 'BOOKING_DEVICE_LIMIT_REACHED';
    end if;
  end if;

  if new.can_decide and new.auth_user_id <> v_owner and new.revoked_at is null then
    if new.device_type <> 'desktop' or new.device_label <> 'Manager Laptop' then
      raise exception 'BOOKING_DECISION_ACCESS_REQUIRES_MANAGER_LAPTOP';
    end if;

    select count(*)
      into v_other_deciders
      from public.pac_booking_device_access d
      where d.workspace_id = new.workspace_id
        and d.auth_user_id <> v_owner
        and d.auth_user_id <> new.auth_user_id
        and d.can_decide = true
        and d.revoked_at is null;

    if v_other_deciders > 0 then
      raise exception 'ONLY_ONE_NON_OWNER_BOOKING_DECIDER';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function public.pac_enforce_booking_device_access_limits() from public, anon, authenticated;
drop trigger if exists pac_booking_device_access_limits on public.pac_booking_device_access;
create trigger pac_booking_device_access_limits
before insert or update of device_type, device_label, can_decide, revoked_at
on public.pac_booking_device_access
for each row execute function public.pac_enforce_booking_device_access_limits();


-- WashDesk 2.13.0: per-device booking alert receipts, action attribution and secure one-time device pairing.
-- Additive only. Existing bookings, owners, invoices and member records are preserved.

alter table public.pac_booking_notification_events
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists actor_label text not null default '';

alter table public.pac_booking_notification_events
  drop constraint if exists pac_booking_notification_events_event_type_check;
alter table public.pac_booking_notification_events
  add constraint pac_booking_notification_events_event_type_check
  check (event_type in ('booking_created','booking_confirmed','booking_rejected','booking_cancelled'));

create table if not exists public.pac_booking_notification_receipts (
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  notification_id uuid not null references public.pac_booking_notification_events(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key (notification_id, auth_user_id)
);
create index if not exists pac_booking_notification_receipts_user_idx
  on public.pac_booking_notification_receipts(workspace_id, auth_user_id, acknowledged_at desc);

alter table public.pac_booking_notification_receipts enable row level security;
revoke all on public.pac_booking_notification_receipts from public, anon, authenticated;
grant all on public.pac_booking_notification_receipts to service_role;

insert into public.pac_booking_notification_receipts(workspace_id, notification_id, auth_user_id, acknowledged_at)
select workspace_id, id, acknowledged_by, acknowledged_at
from public.pac_booking_notification_events
where acknowledged_by is not null and acknowledged_at is not null
on conflict (notification_id, auth_user_id) do nothing;

create table if not exists public.pac_booking_notification_pair_codes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  code_hash text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index if not exists pac_booking_notification_pair_codes_workspace_idx
  on public.pac_booking_notification_pair_codes(workspace_id, created_at desc);

alter table public.pac_booking_notification_pair_codes enable row level security;
revoke all on public.pac_booking_notification_pair_codes from public, anon, authenticated;
grant all on public.pac_booking_notification_pair_codes to service_role;

create or replace function public.pac_redeem_booking_notification_pair_code(
  p_workspace_id uuid,
  p_code_hash text,
  p_auth_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare v_code public.pac_booking_notification_pair_codes%rowtype;
begin
  if not exists (
    select 1 from public.washdesk_workspace_members
    where workspace_id = p_workspace_id and auth_user_id = p_auth_user_id
  ) then raise exception 'DEVICE_NOT_PAIRED'; end if;
  select * into v_code from public.pac_booking_notification_pair_codes
  where workspace_id = p_workspace_id and code_hash = p_code_hash
    and redeemed_at is null and revoked_at is null and expires_at > now()
  for update;
  if not found then raise exception 'PAIR_CODE_INVALID_OR_EXPIRED'; end if;
  update public.pac_booking_notification_pair_codes
    set redeemed_by = p_auth_user_id, redeemed_at = now()
    where id = v_code.id and redeemed_at is null;
  if not found then raise exception 'PAIR_CODE_ALREADY_USED'; end if;
  insert into public.pac_booking_notification_admins(workspace_id,auth_user_id,permission,granted_by,granted_at,revoked_at)
  values(p_workspace_id,p_auth_user_id,'booking_notifications_admin',v_code.created_by,now(),null)
  on conflict(workspace_id,auth_user_id) do update
    set permission=excluded.permission,granted_by=excluded.granted_by,granted_at=now(),revoked_at=null;
  return true;
end;
$function$;
revoke all on function public.pac_redeem_booking_notification_pair_code(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.pac_redeem_booking_notification_pair_code(uuid,text,uuid) to service_role;

-- Permanent PAC Owner Code: self-service booking staff enrolment with Owner-only management.
create table if not exists public.pac_booking_access_codes (
  workspace_id uuid primary key references public.washdesk_workspaces(id) on delete cascade,
  code_hash text not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  enabled boolean not null default true
);
alter table public.pac_booking_access_codes enable row level security;
revoke all on public.pac_booking_access_codes from public, anon, authenticated;
grant all on public.pac_booking_access_codes to service_role;

create table if not exists public.pac_booking_access_code_attempts (
  id bigserial primary key,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  succeeded boolean not null default false
);
create index if not exists pac_booking_access_code_attempts_user_time_idx
  on public.pac_booking_access_code_attempts(auth_user_id, attempted_at desc);
alter table public.pac_booking_access_code_attempts enable row level security;
revoke all on public.pac_booking_access_code_attempts from public, anon, authenticated;
grant all on public.pac_booking_access_code_attempts to service_role;

create or replace function public.pac_join_workspace_with_owner_code(
  p_code_hash text,
  p_device_label text,
  p_device_kind text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user uuid := auth.uid();
  v_code public.pac_booking_access_codes%rowtype;
  v_workspace public.washdesk_workspaces%rowtype;
  v_member public.washdesk_workspace_members%rowtype;
  v_attempts integer;
  v_active integer;
  v_existing_status text;
begin
  if v_user is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;
  if p_device_label not in ('Dad Phone','Zaid Phone','Jack Phone','Manager Phone') then
    raise exception 'INVALID_DEVICE_NAME';
  end if;
  if p_device_kind not in ('phone','desktop') then
    raise exception 'INVALID_DEVICE_TYPE';
  end if;
  if coalesce(p_code_hash,'') !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_CODE_FORMAT';
  end if;

  select count(*) into v_attempts
  from public.pac_booking_access_code_attempts
  where auth_user_id = v_user
    and succeeded = false
    and attempted_at > now() - interval '15 minutes';
  if v_attempts >= 6 then
    return jsonb_build_object('ok',false,'error','RATE_LIMITED','message','Too many incorrect attempts. Wait 15 minutes or ask the Owner to reset the code.');
  end if;

  select * into v_code
  from public.pac_booking_access_codes
  where code_hash = p_code_hash and enabled = true
  limit 1;

  if not found then
    insert into public.pac_booking_access_code_attempts(auth_user_id,succeeded)
    values(v_user,false);
    return jsonb_build_object('ok',false,'error','INVALID_CODE','message','That PAC Owner Code is incorrect.');
  end if;

  select * into v_workspace
  from public.washdesk_workspaces
  where id = v_code.workspace_id;
  if not found or v_workspace.owner_auth_user_id is null then
    raise exception 'OWNER_WORKSPACE_NOT_READY';
  end if;

  select * into v_member
  from public.washdesk_workspace_members
  where auth_user_id = v_user
  limit 1;

  if found and v_member.role = 'owner' then
    insert into public.pac_booking_access_code_attempts(auth_user_id,succeeded)
    values(v_user,true);
    return jsonb_build_object(
      'ok',true,'workspace_id',v_workspace.id,'owner_user_id',v_workspace.owner_auth_user_id,
      'business_name',v_workspace.business_name,'role','owner','already_owner',true
    );
  end if;

  if found and v_member.workspace_id <> v_workspace.id then
    raise exception 'ALREADY_PAIRED_TO_ANOTHER_WORKSPACE';
  end if;

  select status into v_existing_status
  from public.pac_booking_devices
  where workspace_id = v_workspace.id and auth_user_id = v_user;

  select count(*) into v_active
  from public.pac_booking_devices
  where workspace_id = v_workspace.id and status = 'active'
    and auth_user_id <> v_user;
  if coalesce(v_existing_status,'') <> 'active' and v_active >= 4 then
    return jsonb_build_object('ok',false,'error','DEVICE_LIMIT','message','The four staff-device limit is full. Ask the Owner to remove an old device in Business Settings.');
  end if;

  insert into public.washdesk_workspace_members(auth_user_id,workspace_id,role)
  values(v_user,v_workspace.id,'member')
  on conflict(auth_user_id) do update
    set workspace_id = excluded.workspace_id,
        role = case when public.washdesk_workspace_members.role = 'owner' then 'owner' else 'member' end;

  insert into public.pac_booking_devices(
    workspace_id,auth_user_id,device_label,device_kind,status,can_decide_bookings,
    requested_at,approved_at,approved_by,last_seen_at,revoked_at
  ) values(
    v_workspace.id,v_user,p_device_label,p_device_kind,'active',true,
    now(),now(),v_code.updated_by,now(),null
  )
  on conflict(workspace_id,auth_user_id) do update set
    device_label = excluded.device_label,
    device_kind = excluded.device_kind,
    status = 'active',
    can_decide_bookings = true,
    requested_at = coalesce(public.pac_booking_devices.requested_at,now()),
    approved_at = now(),
    approved_by = v_code.updated_by,
    last_seen_at = now(),
    revoked_at = null;

  insert into public.pac_booking_notification_admins(
    workspace_id,auth_user_id,permission,granted_by,granted_at,revoked_at
  ) values(
    v_workspace.id,v_user,'booking_notifications_admin',v_code.updated_by,now(),null
  )
  on conflict(workspace_id,auth_user_id) do update
    set permission = excluded.permission,
        granted_by = excluded.granted_by,
        granted_at = excluded.granted_at,
        revoked_at = null;

  insert into public.pac_booking_access_code_attempts(auth_user_id,succeeded)
  values(v_user,true);

  return jsonb_build_object(
    'ok',true,'workspace_id',v_workspace.id,'owner_user_id',v_workspace.owner_auth_user_id,
    'business_name',v_workspace.business_name,'role','member','device_label',p_device_label,
    'device_kind',p_device_kind,'can_decide_bookings',true
  );
end;
$function$;

revoke all on function public.pac_join_workspace_with_owner_code(text,text,text) from public, anon;
grant execute on function public.pac_join_workspace_with_owner_code(text,text,text) to authenticated;

-- Members can no longer download the complete business database snapshot.
create or replace function public.washdesk_can_read_sync(p_owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.washdesk_workspace_members m
    join public.washdesk_workspaces w on w.id = m.workspace_id
    where m.auth_user_id = auth.uid()
      and m.role = 'owner'
      and w.owner_auth_user_id = p_owner_user_id
  );
$function$;
revoke all on function public.washdesk_can_read_sync(uuid) from public, anon;
grant execute on function public.washdesk_can_read_sync(uuid) to authenticated;

-- Retain existing merge/counter implementations behind Owner-only security-definer wrappers.
alter function public.washdesk_merge_sync(jsonb) rename to washdesk_merge_sync_owner_internal;
revoke all on function public.washdesk_merge_sync_owner_internal(jsonb) from public, anon, authenticated;
create function public.washdesk_merge_sync(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1 from public.washdesk_workspace_members
    where auth_user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'OWNER_ONLY: Staff devices have booking-only access.';
  end if;
  return public.washdesk_merge_sync_owner_internal(p_payload);
end;
$function$;
revoke all on function public.washdesk_merge_sync(jsonb) from public, anon;
grant execute on function public.washdesk_merge_sync(jsonb) to authenticated;

alter function public.washdesk_next_invoice_number(text,date,integer) rename to washdesk_next_invoice_number_owner_internal;
revoke all on function public.washdesk_next_invoice_number_owner_internal(text,date,integer) from public, anon, authenticated;
create function public.washdesk_next_invoice_number(
  p_prefix text default 'CW', p_date date default current_date, p_min_next_value integer default 1
) returns text
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not exists (
    select 1 from public.washdesk_workspace_members
    where auth_user_id = auth.uid() and role = 'owner'
  ) then
    raise exception 'OWNER_ONLY: Staff devices cannot create invoices.';
  end if;
  return public.washdesk_next_invoice_number_owner_internal(p_prefix,p_date,p_min_next_value);
end;
$function$;
revoke all on function public.washdesk_next_invoice_number(text,date,integer) from public, anon;
grant execute on function public.washdesk_next_invoice_number(text,date,integer) to authenticated;

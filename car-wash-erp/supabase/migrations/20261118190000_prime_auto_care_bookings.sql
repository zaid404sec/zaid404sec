-- Prime Auto Care booking system (additive migration).
-- Existing invoices, customers, vehicles, inventory, staff and workspace ownership are untouched.

create table if not exists public.pac_booking_settings (
  workspace_id uuid primary key references public.washdesk_workspaces(id) on delete cascade,
  public_slug text not null unique default 'prime-auto-care',
  timezone text not null default 'Asia/Kolkata',
  opening_time time not null default '08:00',
  closing_time time not null default '19:00',
  slot_minutes smallint not null default 30 check (slot_minutes in (15, 30, 60)),
  slot_capacity smallint not null default 1 check (slot_capacity between 1 and 5),
  horizon_days smallint not null default 14 check (horizon_days between 1 and 60),
  public_enabled boolean not null default true,
  contact_phone text not null default '+917777970261',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closing_time > opening_time),
  check (length(public_slug) between 3 and 80)
);

insert into public.pac_booking_settings (workspace_id, public_slug, timezone, opening_time, closing_time, slot_minutes, slot_capacity, horizon_days, public_enabled, contact_phone)
select id, 'prime-auto-care', 'Asia/Kolkata', '08:00', '19:00', 30, 1, 14, true, '+917777970261'
from public.washdesk_workspaces
where lower(business_name) = 'prime auto care'
on conflict (workspace_id) do nothing;

create table if not exists public.pac_bookings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  booking_code text not null unique,
  customer_name text not null,
  customer_phone text not null,
  customer_phone_hash text not null,
  vehicle_number text not null,
  vehicle_type text not null,
  service_type text not null,
  booking_date date not null,
  start_time time not null,
  duration_minutes smallint not null check (duration_minutes in (30, 60)),
  notes text not null default '',
  status text not null default 'pending'
    check (status in ('pending','confirmed','rescheduled','cancelled','completed','no_show')),
  source text not null default 'public' check (source in ('public','staff')),
  created_by uuid references auth.users(id),
  status_note text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(customer_name) between 2 and 80),
  check (length(customer_phone) between 10 and 16),
  check (length(vehicle_number) between 4 and 20),
  check (length(vehicle_type) between 2 and 40),
  check (length(service_type) between 2 and 60),
  check (length(notes) <= 600)
);

create index if not exists pac_bookings_workspace_date_idx
  on public.pac_bookings(workspace_id, booking_date, start_time);

create index if not exists pac_bookings_workspace_status_idx
  on public.pac_bookings(workspace_id, status, booking_date);

create index if not exists pac_bookings_phone_hash_recent_idx
  on public.pac_bookings(workspace_id, customer_phone_hash, created_at desc)
  where source = 'public';

alter table public.pac_booking_settings enable row level security;
alter table public.pac_bookings enable row level security;
revoke all on public.pac_booking_settings from public, anon, authenticated;
revoke all on public.pac_bookings from public, anon, authenticated;
grant all on public.pac_booking_settings to service_role;
grant all on public.pac_bookings to service_role;

-- The booking Edge Function calls this atomic operation with the server-only secret key.
-- A transaction-scoped advisory lock serializes requests for the same workspace and day,
-- preventing two customers from claiming the last available slot at the same time.
create or replace function public.pac_create_booking(
  p_workspace_id uuid,
  p_booking_code text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_phone_hash text,
  p_vehicle_number text,
  p_vehicle_type text,
  p_service_type text,
  p_booking_date date,
  p_start_time time,
  p_duration_minutes integer,
  p_notes text,
  p_source text,
  p_created_by uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_settings public.pac_booking_settings%rowtype;
  v_local_today date;
  v_open_min integer;
  v_close_min integer;
  v_start_min integer;
  v_overlap_count integer;
  v_recent_count integer;
  v_expected_duration integer;
  v_booking public.pac_bookings%rowtype;
begin
  if p_source not in ('public','staff') then
    raise exception 'invalid_booking_source';
  end if;

  if p_service_type = 'Wax & Shine' then
    v_expected_duration := 60;
  elsif p_service_type in ('Regular Wash','Foam Wash','Outside Wash') then
    v_expected_duration := 30;
  else
    raise exception 'invalid_service_type';
  end if;
  if p_duration_minutes <> v_expected_duration then
    raise exception 'invalid_service_duration';
  end if;

  select * into v_settings
  from public.pac_booking_settings
  where workspace_id = p_workspace_id;
  if not found then
    raise exception 'booking_settings_missing';
  end if;
  if p_source = 'public' and not v_settings.public_enabled then
    raise exception 'public_booking_disabled';
  end if;

  v_local_today := (now() at time zone v_settings.timezone)::date;
  if p_booking_date < v_local_today
     or p_booking_date > v_local_today + v_settings.horizon_days then
    raise exception 'booking_date_out_of_range';
  end if;

  v_open_min := extract(hour from v_settings.opening_time)::integer * 60
              + extract(minute from v_settings.opening_time)::integer;
  v_close_min := extract(hour from v_settings.closing_time)::integer * 60
               + extract(minute from v_settings.closing_time)::integer;
  v_start_min := extract(hour from p_start_time)::integer * 60
               + extract(minute from p_start_time)::integer;

  if v_start_min < v_open_min
     or v_start_min + p_duration_minutes > v_close_min
     or mod(v_start_min - v_open_min, v_settings.slot_minutes) <> 0 then
    raise exception 'booking_time_out_of_range';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_workspace_id::text || ':' || p_booking_date::text, 0)
  );

  if p_source = 'public' then
    select count(*) into v_recent_count
    from public.pac_bookings
    where workspace_id = p_workspace_id
      and customer_phone_hash = p_customer_phone_hash
      and source = 'public'
      and created_at > now() - interval '2 hours';
    if v_recent_count >= 4 then
      raise exception 'booking_rate_limit';
    end if;
  end if;

  select count(*) into v_overlap_count
  from public.pac_bookings b
  where b.workspace_id = p_workspace_id
    and b.booking_date = p_booking_date
    and b.status in ('pending','confirmed','rescheduled')
    and b.start_time < p_start_time + make_interval(mins => p_duration_minutes)
    and b.start_time + make_interval(mins => b.duration_minutes) > p_start_time;

  if v_overlap_count >= v_settings.slot_capacity then
    raise exception 'booking_slot_unavailable';
  end if;

  insert into public.pac_bookings (
    workspace_id, booking_code, customer_name, customer_phone, customer_phone_hash,
    vehicle_number, vehicle_type, service_type, booking_date, start_time,
    duration_minutes, notes, status, source, created_by
  ) values (
    p_workspace_id, p_booking_code, p_customer_name, p_customer_phone, p_customer_phone_hash,
    upper(p_vehicle_number), p_vehicle_type, p_service_type, p_booking_date, p_start_time,
    p_duration_minutes, coalesce(p_notes,''), 'pending', p_source, p_created_by
  )
  returning * into v_booking;

  return jsonb_build_object(
    'id', v_booking.id,
    'booking_code', v_booking.booking_code,
    'status', v_booking.status,
    'booking_date', v_booking.booking_date,
    'start_time', to_char(v_booking.start_time, 'HH24:MI'),
    'duration_minutes', v_booking.duration_minutes,
    'created_at', v_booking.created_at
  );
end;
$function$;

revoke all on function public.pac_create_booking(uuid,text,text,text,text,text,text,text,date,time,integer,text,text,uuid) from public, anon, authenticated;
grant execute on function public.pac_create_booking(uuid,text,text,text,text,text,text,text,date,time,integer,text,text,uuid) to service_role;

-- WashDesk 2.12.0: urgent bookings, owner booking alerts and Google reply moderation state.
-- Additive only. Existing workspaces, owner, invoices, customers and booking rows are preserved.

alter table public.pac_bookings
  add column if not exists is_urgent boolean not null default false;

alter table public.pac_booking_settings
  add column if not exists notification_channel text not null default 'in_app',
  add column if not exists notification_phone text not null default '',
  add column if not exists notification_whatsapp_template text not null default '';

alter table public.pac_booking_settings
  drop constraint if exists pac_booking_settings_notification_channel_check;
alter table public.pac_booking_settings
  add constraint pac_booking_settings_notification_channel_check
  check (notification_channel in ('in_app', 'whatsapp'));

create index if not exists pac_bookings_workspace_urgent_date_idx
  on public.pac_bookings(workspace_id, is_urgent, booking_date, start_time);

create index if not exists pac_bookings_created_by_idx
  on public.pac_bookings(created_by)
  where created_by is not null;

create table if not exists public.pac_booking_notification_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  booking_id uuid not null references public.pac_bookings(id) on delete cascade,
  event_type text not null default 'booking_created'
    check (event_type in ('booking_created', 'booking_confirmed', 'booking_cancelled')),
  booking_code text not null,
  customer_name text not null,
  customer_phone text not null,
  vehicle_number text not null,
  vehicle_type text not null,
  service_type text not null,
  booking_date date not null,
  start_time time not null,
  is_urgent boolean not null default false,
  source text not null check (source in ('public', 'staff')),
  delivery_status text not null default 'in_app'
    check (delivery_status in ('in_app', 'queued', 'sent', 'failed')),
  communication_job_id uuid references public.pac_communication_jobs(id) on delete set null,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, booking_id, event_type)
);

create index if not exists pac_booking_notification_events_unread_idx
  on public.pac_booking_notification_events(workspace_id, created_at desc)
  where acknowledged_at is null;

alter table public.pac_booking_notification_events enable row level security;
revoke all on public.pac_booking_notification_events from public, anon, authenticated;
grant all on public.pac_booking_notification_events to service_role;

-- Keep the original atomic slot-reservation function untouched. The wrapper calls it,
-- then attaches the urgency flag to the newly-created booking inside the same transaction.
create or replace function public.pac_create_booking_with_urgency(
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
  p_created_by uuid,
  p_is_urgent boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_booking jsonb;
  v_booking_id uuid;
begin
  v_booking := public.pac_create_booking(
    p_workspace_id, p_booking_code, p_customer_name, p_customer_phone,
    p_customer_phone_hash, p_vehicle_number, p_vehicle_type, p_service_type,
    p_booking_date, p_start_time, p_duration_minutes, p_notes, p_source, p_created_by
  );
  v_booking_id := (v_booking->>'id')::uuid;

  update public.pac_bookings
     set is_urgent = coalesce(p_is_urgent, false),
         updated_at = now()
   where id = v_booking_id
     and workspace_id = p_workspace_id;

  return jsonb_set(v_booking, '{is_urgent}', to_jsonb(coalesce(p_is_urgent, false)), true);
end;
$function$;

revoke all on function public.pac_create_booking_with_urgency(
  uuid,text,text,text,text,text,text,text,date,time,integer,text,text,uuid,boolean
) from public, anon, authenticated;
grant execute on function public.pac_create_booking_with_urgency(
  uuid,text,text,text,text,text,text,text,date,time,integer,text,text,uuid,boolean
) to service_role;

alter table public.pac_google_reviews
  add column if not exists reply_publication_state text not null default 'REVIEW_REPLY_STATE_UNSPECIFIED',
  add column if not exists reply_policy_violation text,
  add column if not exists reply_state_checked_at timestamptz;

alter table public.pac_review_reply_drafts
  add column if not exists publication_state text not null default 'NOT_SUBMITTED',
  add column if not exists publication_policy_violation text,
  add column if not exists publication_checked_at timestamptz,
  add column if not exists publication_error text;

comment on column public.pac_google_reviews.reply_publication_state is
  'Google Business Profile ReviewReply.reviewReplyState: PENDING, APPROVED, REJECTED or REVIEW_REPLY_STATE_UNSPECIFIED.';
comment on column public.pac_review_reply_drafts.publication_state is
  'Google moderation state; HTTP 200 from updateReply is not treated as public approval.';

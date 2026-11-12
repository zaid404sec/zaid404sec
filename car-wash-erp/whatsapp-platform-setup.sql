-- Prime Auto Care — WhatsApp Business Platform (Cloud API) foundation
-- Run this AFTER the current cloud-sync-setup.sql, without dropping existing tables.
-- All credentials are kept in a private table and are only read by Edge Functions
-- running with the Supabase service role. Never grant this table to anon/authenticated.

create table if not exists public.washdesk_whatsapp_connections (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  waba_id text not null,
  phone_number_id text not null unique,
  display_phone_number text not null,
  verified_name text,
  is_on_biz_app boolean not null default false,
  access_token_ciphertext text not null,
  access_token_iv text not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.washdesk_whatsapp_connections enable row level security;
revoke all on public.washdesk_whatsapp_connections from public, anon, authenticated;
grant all on public.washdesk_whatsapp_connections to service_role;

create table if not exists public.washdesk_whatsapp_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  customer_id text,
  recipient_name text not null default '',
  to_phone text not null,
  source_type text not null check (source_type in ('campaign','invoice','opening_announcement')),
  source_id text,
  template_name text not null,
  language_code text not null default 'en',
  body_parameters jsonb not null default '[]'::jsonb,
  header_image_url text,
  header_document_url text,
  header_document_name text,
  status text not null default 'queued'
    check (status in ('queued','processing','sent','delivered','read','failed','cancelled')),
  idempotency_key text not null unique,
  meta_message_id text unique,
  attempts integer not null default 0,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists washdesk_whatsapp_jobs_due_idx
  on public.washdesk_whatsapp_jobs(status, scheduled_at, created_at);
create index if not exists washdesk_whatsapp_jobs_owner_idx
  on public.washdesk_whatsapp_jobs(owner_user_id, created_at desc);
alter table public.washdesk_whatsapp_jobs enable row level security;
revoke all on public.washdesk_whatsapp_jobs from public, anon, authenticated;
grant all on public.washdesk_whatsapp_jobs to service_role;

create table if not exists public.washdesk_whatsapp_schedules (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  title text not null default 'Daily opening announcement',
  daily_time time not null,
  timezone text not null default 'Asia/Kolkata',
  template_name text not null,
  language_code text not null default 'en',
  body_parameters jsonb not null default '[]'::jsonb,
  header_image_url text,
  enabled boolean not null default true,
  last_enqueued_local_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists washdesk_whatsapp_schedules_due_idx
  on public.washdesk_whatsapp_schedules(enabled, daily_time);
alter table public.washdesk_whatsapp_schedules enable row level security;
revoke all on public.washdesk_whatsapp_schedules from public, anon, authenticated;
grant all on public.washdesk_whatsapp_schedules to service_role;

create table if not exists public.washdesk_whatsapp_preferences (
  owner_user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  invoice_template_name text,
  invoice_language_code text not null default 'en',
  opening_schedule_id uuid references public.washdesk_whatsapp_schedules(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.washdesk_whatsapp_preferences enable row level security;
revoke all on public.washdesk_whatsapp_preferences from public, anon, authenticated;
grant all on public.washdesk_whatsapp_preferences to service_role;

create table if not exists public.washdesk_whatsapp_webhook_events (
  id bigint generated always as identity primary key,
  owner_user_id uuid references auth.users(id) on delete cascade,
  phone_number_id text,
  meta_message_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  received_at timestamptz not null default now()
);
create index if not exists washdesk_whatsapp_events_owner_idx
  on public.washdesk_whatsapp_webhook_events(owner_user_id, received_at desc);
alter table public.washdesk_whatsapp_webhook_events enable row level security;
revoke all on public.washdesk_whatsapp_webhook_events from public, anon, authenticated;
grant all on public.washdesk_whatsapp_webhook_events to service_role;

-- Claim due jobs atomically. SKIP LOCKED prevents two dispatchers from sending
-- the same message when cron and an operator trigger overlap.
create or replace function public.washdesk_whatsapp_claim_jobs(p_limit integer default 20)
returns setof public.washdesk_whatsapp_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  return query
  with picked as (
    select id
    from public.washdesk_whatsapp_jobs
    where status = 'queued' and scheduled_at <= now()
    order by scheduled_at, created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,20), 100))
  )
  update public.washdesk_whatsapp_jobs j
     set status = 'processing',
         attempts = j.attempts + 1,
         updated_at = now()
    from picked
   where j.id = picked.id
  returning j.*;
end;
$$;
revoke all on function public.washdesk_whatsapp_claim_jobs(integer) from public, anon, authenticated;
grant execute on function public.washdesk_whatsapp_claim_jobs(integer) to service_role;

-- Daily schedule claims use the schedule's own IANA timezone and a per-local-date
-- marker, so DST and duplicate cron invocations do not create duplicate campaigns.
create or replace function public.washdesk_whatsapp_claim_due_schedules()
returns setof public.washdesk_whatsapp_schedules
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  return query
  with due as (
    select id
    from public.washdesk_whatsapp_schedules s
    where s.enabled
      and (now() at time zone s.timezone)::time >= s.daily_time
      and s.last_enqueued_local_date is distinct from (now() at time zone s.timezone)::date
    order by s.daily_time
    for update skip locked
  )
  update public.washdesk_whatsapp_schedules s
     set last_enqueued_local_date = (now() at time zone s.timezone)::date,
         updated_at = now()
    from due
   where s.id = due.id
  returning s.*;
end;
$$;
revoke all on function public.washdesk_whatsapp_claim_due_schedules() from public, anon, authenticated;
grant execute on function public.washdesk_whatsapp_claim_due_schedules() to service_role;

-- Check that no existing customer data, invoices or cloud-sync rows were changed.
select
  to_regclass('public.washdesk_whatsapp_connections') as whatsapp_connections,
  to_regclass('public.washdesk_whatsapp_jobs') as whatsapp_queue,
  to_regclass('public.washdesk_whatsapp_schedules') as whatsapp_schedules,
  to_regclass('public.washdesk_whatsapp_preferences') as whatsapp_preferences;

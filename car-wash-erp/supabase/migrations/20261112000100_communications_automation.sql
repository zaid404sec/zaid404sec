-- Prime Auto Care communications automation schema
-- Apply with: supabase db push
-- Credentials are NEVER stored in these tables or inside the Android/Windows app.

create or replace function public.pac_is_workspace_member(p_workspace_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.washdesk_workspace_members m
    where m.workspace_id = p_workspace_id and m.auth_user_id = auth.uid()
  );
$$;
revoke all on function public.pac_is_workspace_member(uuid) from public, anon;
grant execute on function public.pac_is_workspace_member(uuid) to authenticated;

create table if not exists public.pac_communication_settings (
  workspace_id uuid primary key references public.washdesk_workspaces(id) on delete cascade,
  whatsapp_business_number text,
  whatsapp_phone_number_id text,
  whatsapp_waba_id text,
  whatsapp_marketing_template text not null default 'prime_auto_care_offer',
  whatsapp_marketing_image_template text not null default '',
  whatsapp_invoice_template text not null default 'prime_auto_care_invoice',
  whatsapp_opening_template text not null default 'prime_auto_care_opening',
  whatsapp_language text not null default 'en',
  exotel_account_sid text,
  exotel_region text not null default 'in' check (exotel_region in ('in','sg')),
  exotel_caller_id text,
  exotel_voice_flow_url text,
  dlt_entity_id text,
  dlt_sender_id text,
  dlt_promo_template_id text,
  dlt_promo_template_text text,
  dlt_service_template_id text,
  dlt_service_template_text text,
  server_opening_enabled boolean not null default false,
  server_opening_time time not null default '08:00',
  server_opening_timezone text not null default 'Asia/Kolkata',
  server_opening_channels text[] not null default array['whatsapp']::text[],
  server_opening_message text not null default 'Good morning! {business} is open today from {opening} to {closing}. Visit us for a fresh, spotless finish for your vehicle. Location: {location}. Contact: {phone}.',
  server_opening_last_enqueued date,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  constraint pac_opening_timezone_length check (length(server_opening_timezone) between 3 and 80),
  constraint pac_opening_channels_valid check (server_opening_channels <@ array['whatsapp','sms','voice']::text[])
);
alter table public.pac_communication_settings add column if not exists whatsapp_marketing_image_template text not null default '';
alter table public.pac_communication_settings enable row level security;
revoke all on public.pac_communication_settings from anon, authenticated;
drop policy if exists pac_communication_settings_read on public.pac_communication_settings;
create policy pac_communication_settings_read on public.pac_communication_settings
  for select to authenticated using (public.pac_is_workspace_member(workspace_id));

create table if not exists public.pac_communication_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  campaign_id uuid,
  customer_id text,
  channel text not null check (channel in ('whatsapp','sms','voice')),
  purpose text not null check (purpose in ('marketing','service','invoice','opening')),
  recipient_e164 text not null,
  recipient_name text,
  status text not null default 'queued' check (status in ('queued','processing','accepted','sent','delivered','read','failed','blocked','cancelled')),
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  provider_message_id text,
  provider_status text,
  provider_response jsonb,
  error_code text,
  error_message text,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  scheduled_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  locked_at timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);
create index if not exists pac_communication_jobs_due_idx
  on public.pac_communication_jobs(status, scheduled_at, next_attempt_at)
  where status in ('queued','processing');
create index if not exists pac_communication_jobs_workspace_idx
  on public.pac_communication_jobs(workspace_id, created_at desc);
create index if not exists pac_communication_jobs_provider_idx
  on public.pac_communication_jobs(provider_message_id)
  where provider_message_id is not null;
alter table public.pac_communication_jobs enable row level security;
revoke all on public.pac_communication_jobs from anon, authenticated;
drop policy if exists pac_communication_jobs_read on public.pac_communication_jobs;
create policy pac_communication_jobs_read on public.pac_communication_jobs
  for select to authenticated using (public.pac_is_workspace_member(workspace_id));

create table if not exists public.pac_communication_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  job_id uuid references public.pac_communication_jobs(id) on delete set null,
  channel text not null,
  event_type text not null,
  provider_message_id text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists pac_communication_events_job_idx
  on public.pac_communication_events(job_id, occurred_at desc);
alter table public.pac_communication_events enable row level security;
revoke all on public.pac_communication_events from anon, authenticated;
drop policy if exists pac_communication_events_read on public.pac_communication_events;
create policy pac_communication_events_read on public.pac_communication_events
  for select to authenticated using (public.pac_is_workspace_member(workspace_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pac-communication-media',
  'pac-communication-media',
  false,
  12582912,
  array['application/pdf','image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 12582912,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.pac_claim_communication_jobs(p_limit integer default 10)
returns setof public.pac_communication_jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select j.id
    from public.pac_communication_jobs j
    where (
      (j.status = 'queued' and j.scheduled_at <= now())
      or (j.status = 'processing' and j.locked_at < now() - interval '5 minutes')
    )
    and (j.next_attempt_at is null or j.next_attempt_at <= now())
    and j.attempts < j.max_attempts
    order by j.scheduled_at, j.created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,10),25))
  )
  update public.pac_communication_jobs j
    set status = 'processing',
        attempts = j.attempts + 1,
        locked_at = now(),
        updated_at = now()
    from candidates c
    where j.id = c.id
  returning j.*;
end;
$$;
revoke all on function public.pac_claim_communication_jobs(integer) from public, anon, authenticated;
grant execute on function public.pac_claim_communication_jobs(integer) to service_role;

create or replace function public.pac_claim_due_opening_schedules(p_limit integer default 5)
returns setof public.pac_communication_settings
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Read due schedules under row locks, but do not mark them complete here.
  -- The worker marks the date only AFTER it has durably inserted all queue rows.
  -- This makes a worker crash/retry safe: the next minute can re-read the schedule,
  -- and the queue's unique idempotency key prevents duplicate recipient jobs.
  return query
    select s.*
    from public.pac_communication_settings s
    where s.server_opening_enabled
      and (now() at time zone s.server_opening_timezone)::date
          is distinct from s.server_opening_last_enqueued
      and (now() at time zone s.server_opening_timezone)::time >= s.server_opening_time
    order by s.server_opening_time
    limit greatest(1, least(coalesce(p_limit,5),20))
    for update skip locked;
end;
$$;
revoke all on function public.pac_claim_due_opening_schedules(integer) from public, anon, authenticated;
grant execute on function public.pac_claim_due_opening_schedules(integer) to service_role;

create or replace function public.pac_update_communication_job_status(
  p_job_id uuid,
  p_status text,
  p_provider_message_id text default null,
  p_provider_status text default null,
  p_error_code text default null,
  p_error_message text default null,
  p_provider_response jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_workspace_id uuid;
begin
  select workspace_id into v_workspace_id from public.pac_communication_jobs where id = p_job_id;
  if v_workspace_id is null then return; end if;
  update public.pac_communication_jobs
  set status = p_status,
      provider_message_id = coalesce(p_provider_message_id, provider_message_id),
      provider_status = coalesce(p_provider_status, provider_status),
      error_code = p_error_code,
      error_message = p_error_message,
      provider_response = coalesce(p_provider_response, '{}'::jsonb),
      locked_at = null,
      sent_at = case when p_status in ('accepted','sent','delivered','read') then coalesce(sent_at, now()) else sent_at end,
      delivered_at = case when p_status in ('delivered','read') then coalesce(delivered_at, now()) else delivered_at end,
      updated_at = now()
  where id = p_job_id;

  insert into public.pac_communication_events(workspace_id, job_id, channel, event_type, provider_message_id, details)
  select workspace_id, id, channel, p_status, coalesce(p_provider_message_id, provider_message_id),
         jsonb_build_object('provider_status',p_provider_status,'error_code',p_error_code,'error_message',p_error_message)
  from public.pac_communication_jobs where id = p_job_id;
end;
$$;
revoke all on function public.pac_update_communication_job_status(uuid,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.pac_update_communication_job_status(uuid,text,text,text,text,text,jsonb) to service_role;

-- Optional one-minute schedule. Configure the Vault secrets first, then run
-- communications-cron-setup.sql to enable unattended queue processing.

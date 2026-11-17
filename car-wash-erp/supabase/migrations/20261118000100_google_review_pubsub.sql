-- Prime Auto Care Google Pub/Sub push notification events.
-- Additive only. Existing Business Profile review and WashDesk records are retained.

alter table public.pac_google_review_settings
  add column if not exists notifications_enabled boolean not null default false,
  add column if not exists notifications_last_error text,
  add column if not exists notifications_last_event_at timestamptz;

create table if not exists public.pac_google_review_events (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  pubsub_message_id text not null,
  notification_type text not null,
  location_name text,
  review_name text,
  publish_time timestamptz,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload jsonb not null default '{}'::jsonb,
  unique (workspace_id, pubsub_message_id)
);
create index if not exists pac_google_review_events_recent_idx
  on public.pac_google_review_events(workspace_id, received_at desc);

alter table public.pac_google_review_events enable row level security;
revoke all on public.pac_google_review_events from anon, authenticated;
grant select on public.pac_google_review_events to authenticated;
grant all on public.pac_google_review_events to service_role;
create policy pac_google_review_events_read
  on public.pac_google_review_events for select to authenticated
  using (public.pac_is_workspace_member(workspace_id));

comment on column public.pac_google_review_settings.notifications_enabled is
  'True only after the Notifications API accepted the Pub/Sub topic registration.';
comment on table public.pac_google_review_events is
  'Deduplicated Google Business Profile Pub/Sub events received by the authenticated push webhook.';

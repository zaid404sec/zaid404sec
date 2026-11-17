-- Prime Auto Care Google Review Management + GenAI storage.
-- Additive migration only: does not rewrite or delete WashDesk business records.
-- Google OAuth / AI provider secrets are intentionally NOT stored in these tables.

create or replace function public.pac_is_workspace_owner(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.washdesk_workspace_members m
    where m.workspace_id = p_workspace_id
      and m.auth_user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

revoke all on function public.pac_is_workspace_owner(uuid) from public, anon;
grant execute on function public.pac_is_workspace_owner(uuid) to authenticated;

create table if not exists public.pac_google_review_settings (
  workspace_id uuid primary key references public.washdesk_workspaces(id) on delete cascade,
  google_account_email text,
  google_business_profile_id text,
  google_business_profile_url text,
  website_url text,
  review_link text,
  api_status text not null default 'access_pending'
    check (api_status in ('not_connected','access_pending','connected','expired','error')),
  google_cloud_project_number text,
  pubsub_topic_name text,
  last_successful_sync_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.pac_google_review_settings enable row level security;
revoke all on public.pac_google_review_settings from anon, authenticated;
grant select, insert, update on public.pac_google_review_settings to authenticated;
grant all on public.pac_google_review_settings to service_role;

create table if not exists public.pac_google_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  google_review_id text not null,
  reviewer_name text,
  reviewer_profile_url text,
  star_rating smallint check (star_rating between 1 and 5),
  comment text,
  google_created_at timestamptz,
  google_updated_at timestamptz,
  reply_comment text,
  reply_updated_at timestamptz,
  is_removed boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  last_fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, google_review_id)
);
create index if not exists pac_google_reviews_recent_idx
  on public.pac_google_reviews(workspace_id, google_created_at desc);
create index if not exists pac_google_reviews_unanswered_idx
  on public.pac_google_reviews(workspace_id, star_rating, google_created_at desc)
  where reply_comment is null;
alter table public.pac_google_reviews enable row level security;
revoke all on public.pac_google_reviews from anon, authenticated;
grant select on public.pac_google_reviews to authenticated;
grant all on public.pac_google_reviews to service_role;

create table if not exists public.pac_review_invitation_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  invoice_id text,
  invoice_number text,
  channel text not null check (channel in ('invoice_pdf','whatsapp','counter_qr')),
  status text not null default 'prepared'
    check (status in ('prepared','sent_confirmed','failed','cancelled')),
  prepared_by uuid references auth.users(id),
  sent_confirmed_by uuid references auth.users(id),
  prepared_at timestamptz not null default now(),
  sent_confirmed_at timestamptz,
  notes text,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);
create index if not exists pac_review_invitation_logs_recent_idx
  on public.pac_review_invitation_logs(workspace_id, prepared_at desc);
alter table public.pac_review_invitation_logs enable row level security;
revoke all on public.pac_review_invitation_logs from anon, authenticated;
grant select, insert, update on public.pac_review_invitation_logs to authenticated;
grant all on public.pac_review_invitation_logs to service_role;

create table if not exists public.pac_review_ai_analysis (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  review_row_id uuid not null references public.pac_google_reviews(id) on delete cascade,
  analysis_level smallint not null check (analysis_level in (2,3)),
  sentiment text check (sentiment in ('positive','neutral','negative','mixed')),
  topics jsonb not null default '[]'::jsonb,
  complaint_flag boolean not null default false,
  priority text not null default 'normal'
    check (priority in ('low','normal','high','urgent')),
  summary text,
  recommendations jsonb not null default '[]'::jsonb,
  model_provider text,
  model_name text,
  analysis_payload jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  unique (review_row_id, analysis_level, model_provider, model_name)
);
create index if not exists pac_review_ai_analysis_recent_idx
  on public.pac_review_ai_analysis(workspace_id, generated_at desc);
alter table public.pac_review_ai_analysis enable row level security;
revoke all on public.pac_review_ai_analysis from anon, authenticated;
grant select on public.pac_review_ai_analysis to authenticated;
grant all on public.pac_review_ai_analysis to service_role;

create table if not exists public.pac_review_reply_drafts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  review_row_id uuid not null references public.pac_google_reviews(id) on delete cascade,
  draft_text text not null,
  status text not null default 'draft'
    check (status in ('draft','approved','published','rejected')),
  model_provider text,
  model_name text,
  generated_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  published_at timestamptz,
  google_reply_update_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pac_review_reply_drafts_review_idx
  on public.pac_review_reply_drafts(workspace_id, review_row_id, created_at desc);
alter table public.pac_review_reply_drafts enable row level security;
revoke all on public.pac_review_reply_drafts from anon, authenticated;
grant select on public.pac_review_reply_drafts to authenticated;
grant all on public.pac_review_reply_drafts to service_role;

create table if not exists public.pac_google_review_sync_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  sync_source text not null check (sync_source in ('manual','pubsub','scheduled')),
  status text not null check (status in ('started','success','partial','failed')),
  fetched_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  error_code text,
  error_summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists pac_google_review_sync_logs_recent_idx
  on public.pac_google_review_sync_logs(workspace_id, started_at desc);
alter table public.pac_google_review_sync_logs enable row level security;
revoke all on public.pac_google_review_sync_logs from anon, authenticated;
grant select on public.pac_google_review_sync_logs to authenticated;
grant all on public.pac_google_review_sync_logs to service_role;

-- Workspace members can read only their own workspace's review data.
create policy pac_google_review_settings_read
  on public.pac_google_review_settings for select to authenticated
  using (public.pac_is_workspace_member(workspace_id));
create policy pac_google_review_settings_insert_owner
  on public.pac_google_review_settings for insert to authenticated
  with check (public.pac_is_workspace_owner(workspace_id));
create policy pac_google_review_settings_update_owner
  on public.pac_google_review_settings for update to authenticated
  using (public.pac_is_workspace_owner(workspace_id))
  with check (public.pac_is_workspace_owner(workspace_id));

create policy pac_google_reviews_read
  on public.pac_google_reviews for select to authenticated
  using (public.pac_is_workspace_member(workspace_id));
create policy pac_review_invitation_logs_read
  on public.pac_review_invitation_logs for select to authenticated
  using (public.pac_is_workspace_member(workspace_id));
create policy pac_review_invitation_logs_insert
  on public.pac_review_invitation_logs for insert to authenticated
  with check (public.pac_is_workspace_member(workspace_id));
create policy pac_review_invitation_logs_update
  on public.pac_review_invitation_logs for update to authenticated
  using (public.pac_is_workspace_member(workspace_id))
  with check (public.pac_is_workspace_member(workspace_id));

create policy pac_review_ai_analysis_read
  on public.pac_review_ai_analysis for select to authenticated
  using (public.pac_is_workspace_member(workspace_id));
create policy pac_review_reply_drafts_read
  on public.pac_review_reply_drafts for select to authenticated
  using (public.pac_is_workspace_member(workspace_id));
create policy pac_google_review_sync_logs_read
  on public.pac_google_review_sync_logs for select to authenticated
  using (public.pac_is_workspace_member(workspace_id));

-- Do not store OAuth refresh tokens, access tokens, Gemini/AI keys, or Google
-- client secrets in the APK or these browser-readable tables. Keep them in
-- Supabase Edge Function secrets / a server-side secret store only.

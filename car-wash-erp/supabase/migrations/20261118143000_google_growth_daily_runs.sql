-- WashDesk 2.10.0: one daily AI post run per workspace in Asia/Kolkata.
-- Additive only. Does not alter customer, invoice, inventory or payroll records.
create table if not exists public.pac_google_growth_daily_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  run_date date not null,
  state text not null default 'generating' check (state in ('generating','completed','failed')),
  requested_posts smallint not null default 2 check (requested_posts between 1 and 2),
  generated_posts smallint not null default 0 check (generated_posts between 0 and 2),
  created_by uuid not null references auth.users(id),
  model_name text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, run_date)
);

create index if not exists pac_google_growth_daily_runs_workspace_date_idx
  on public.pac_google_growth_daily_runs(workspace_id, run_date desc);

alter table public.pac_google_growth_daily_runs enable row level security;
revoke all on public.pac_google_growth_daily_runs from public, anon, authenticated;
grant all on public.pac_google_growth_daily_runs to service_role;

comment on table public.pac_google_growth_daily_runs is
  'Server-only idempotency guard for daily Google Business Profile post drafts. One run per workspace per Asia/Kolkata date; no automatic publication.';

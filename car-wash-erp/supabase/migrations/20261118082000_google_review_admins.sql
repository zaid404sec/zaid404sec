-- Scoped Google Reviews administration for authorised workspace members.
-- This table deliberately has no authenticated policies or grants.
-- All permission checks are performed server-side by google-review-api and OAuth callback.

create table if not exists public.pac_google_review_admins (
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null default 'google_reviews_admin'
    check (permission = 'google_reviews_admin'),
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (workspace_id, auth_user_id)
);

alter table public.pac_google_review_admins enable row level security;
revoke all on public.pac_google_review_admins from anon, authenticated;
grant all on public.pac_google_review_admins to service_role;

comment on table public.pac_google_review_admins is
  'Server-only allowlist for Google Reviews administration. Does not change washdesk_workspace_members.role or grant access to other WashDesk modules.';
comment on column public.pac_google_review_admins.permission is
  'Only google_reviews_admin is supported. Broader workspace privileges must never be stored here.';

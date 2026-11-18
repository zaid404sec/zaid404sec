-- WashDesk 2.9.5 Google AI Growth Studio
-- Additive, workspace-scoped tables. Existing WashDesk business records and roles are untouched.
create table if not exists public.pac_google_growth_posts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  title text not null,
  topic text not null default 'service',
  summary text not null,
  caption text not null default '',
  primary_keyword text,
  secondary_keywords text[] not null default '{}',
  image_prompt text,
  photo_checklist text[] not null default '{}',
  image_url text,
  image_object_path text,
  suggested_publish_at timestamptz,
  status text not null default 'draft' check (status in ('draft','ready','scheduled','published','failed','archived')),
  google_post_name text,
  model_provider text,
  model_name text,
  published_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists pac_google_growth_posts_workspace_created_idx
  on public.pac_google_growth_posts(workspace_id, created_at desc);

create table if not exists public.pac_google_growth_keywords (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  keyword text not null,
  intent text not null default 'local service',
  cluster text not null default 'local car wash',
  priority text not null default 'medium' check (priority in ('high','medium','low')),
  relevance_score integer not null default 50 check (relevance_score between 1 and 100),
  rationale text not null default '',
  trend_url text,
  evidence_type text not null default 'ai_relevance_suggestion' check (evidence_type = 'ai_relevance_suggestion'),
  created_at timestamptz not null default now(),
  unique (workspace_id, keyword)
);
create index if not exists pac_google_growth_keywords_workspace_score_idx
  on public.pac_google_growth_keywords(workspace_id, relevance_score desc);

alter table public.pac_google_growth_posts enable row level security;
alter table public.pac_google_growth_keywords enable row level security;
revoke all on public.pac_google_growth_posts from anon, authenticated;
revoke all on public.pac_google_growth_keywords from anon, authenticated;
grant all on public.pac_google_growth_posts to service_role;
grant all on public.pac_google_growth_keywords to service_role;

-- Google can fetch a post image using a public sourceUrl. Uploads are performed only
-- by the authenticated Edge Function using service_role; no browser write policy is granted.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pac-google-growth-media','pac-google-growth-media',true,5242880,array['image/jpeg','image/png']::text[])
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

comment on table public.pac_google_growth_posts is
  'Owner-managed Google Business Profile post drafts and publication records. All reads/writes are server-side through the Google Review API Edge Function.';
comment on table public.pac_google_growth_keywords is
  'AI-generated keyword relevance suggestions. These are not Google monthly search-volume measurements.';

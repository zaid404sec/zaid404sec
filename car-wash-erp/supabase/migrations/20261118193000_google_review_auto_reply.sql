-- Owner-controlled, opt-in Google review auto-replies.
-- Uses only the event-driven Pub/Sub worker. No historical bulk auto-replies.

alter table public.pac_google_review_settings
  add column if not exists auto_reply_enabled boolean not null default false,
  add column if not exists auto_reply_min_rating smallint not null default 5,
  add column if not exists auto_reply_last_error text,
  add column if not exists auto_reply_last_sent_at timestamptz;

alter table public.pac_google_review_settings
  drop constraint if exists pac_google_review_settings_auto_reply_min_rating_check;
alter table public.pac_google_review_settings
  add constraint pac_google_review_settings_auto_reply_min_rating_check
  check (auto_reply_min_rating in (4, 5));

create table if not exists public.pac_google_review_auto_reply_claims (
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  google_review_id text not null,
  review_row_id uuid references public.pac_google_reviews(id) on delete set null,
  state text not null default 'processing'
    check (state in ('processing','published','skipped','failed')),
  claimed_at timestamptz not null default now(),
  finished_at timestamptz,
  detail text,
  primary key (workspace_id, google_review_id)
);

alter table public.pac_google_review_auto_reply_claims enable row level security;
revoke all on public.pac_google_review_auto_reply_claims from public, anon, authenticated;
grant all on public.pac_google_review_auto_reply_claims to service_role;

create or replace function public.pac_claim_google_auto_reply(
  p_workspace_id uuid,
  p_google_review_id text,
  p_review_row_id uuid,
  p_stale_before timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_claimed text;
begin
  insert into public.pac_google_review_auto_reply_claims (
    workspace_id, google_review_id, review_row_id, state, claimed_at, finished_at, detail
  ) values (
    p_workspace_id, p_google_review_id, p_review_row_id, 'processing', now(), null, null
  )
  on conflict (workspace_id, google_review_id) do update
  set review_row_id = excluded.review_row_id,
      state = 'processing',
      claimed_at = now(),
      finished_at = null,
      detail = null
  where public.pac_google_review_auto_reply_claims.state in ('failed','skipped')
     or (public.pac_google_review_auto_reply_claims.state = 'processing'
         and public.pac_google_review_auto_reply_claims.claimed_at < p_stale_before)
  returning state into v_claimed;

  return found;
end;
$function$;

revoke all on function public.pac_claim_google_auto_reply(uuid,text,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.pac_claim_google_auto_reply(uuid,text,uuid,timestamptz) to service_role;

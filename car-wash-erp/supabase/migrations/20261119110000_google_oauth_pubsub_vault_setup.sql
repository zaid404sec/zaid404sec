-- Store Google OAuth and Pub/Sub worker credentials in Supabase Vault.
-- This removes the need to copy private Google OAuth credentials into Edge Function Secrets.

alter table public.pac_google_review_settings
  add column if not exists pubsub_push_service_account text;

create table if not exists public.pac_google_oauth_app_config (
  workspace_id uuid primary key references public.washdesk_workspaces(id) on delete cascade,
  vault_client_id uuid not null,
  vault_client_secret uuid not null,
  vault_redirect_uri uuid not null,
  vault_encryption_key uuid not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now()
);
alter table public.pac_google_oauth_app_config enable row level security;
revoke all on public.pac_google_oauth_app_config from public,anon,authenticated;
grant all on public.pac_google_oauth_app_config to service_role;

create table if not exists public.pac_google_review_worker_secrets (
  workspace_id uuid primary key references public.washdesk_workspaces(id) on delete cascade,
  vault_secret_id uuid not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz not null default now()
);
alter table public.pac_google_review_worker_secrets enable row level security;
revoke all on public.pac_google_review_worker_secrets from public,anon,authenticated;
grant all on public.pac_google_review_worker_secrets to service_role;

create or replace function public.pac_store_google_oauth_app_config(
  p_workspace_id uuid,p_auth_user_id uuid,p_client_id text,p_client_secret text,
  p_redirect_uri text,p_encryption_key text
)
returns boolean
language plpgsql security definer set search_path=''
as $function$
declare
  v_owner uuid;
  v_ids public.pac_google_oauth_app_config%rowtype;
  v_client_id uuid; v_client_secret uuid; v_redirect_uri uuid; v_encryption_key uuid;
  v_name text := 'prime_auto_care_google_oauth_' || replace(p_workspace_id::text,'-','');
begin
  select owner_auth_user_id into v_owner from public.washdesk_workspaces where id=p_workspace_id;
  if v_owner is null or v_owner<>p_auth_user_id then raise exception 'ORIGINAL_WORKSPACE_OWNER_REQUIRED'; end if;
  if length(coalesce(p_client_id,''))<30 or length(coalesce(p_client_secret,''))<12
     or length(coalesce(p_redirect_uri,''))<30 or length(coalesce(p_encryption_key,''))<32 then
    raise exception 'GOOGLE_OAUTH_CONFIG_INVALID';
  end if;
  select * into v_ids from public.pac_google_oauth_app_config where workspace_id=p_workspace_id for update;
  if v_ids.workspace_id is null then
    select id into v_client_id from vault.create_secret(p_client_id,v_name||'_client_id','Google OAuth Web Client ID',null);
    select id into v_client_secret from vault.create_secret(p_client_secret,v_name||'_client_secret','Google OAuth Web Client Secret',null);
    select id into v_redirect_uri from vault.create_secret(p_redirect_uri,v_name||'_redirect_uri','Google OAuth callback URI',null);
    select id into v_encryption_key from vault.create_secret(p_encryption_key,v_name||'_encryption_key','Google token AES-256-GCM encryption key',null);
    insert into public.pac_google_oauth_app_config(workspace_id,vault_client_id,vault_client_secret,vault_redirect_uri,vault_encryption_key,updated_by,updated_at)
    values(p_workspace_id,v_client_id,v_client_secret,v_redirect_uri,v_encryption_key,p_auth_user_id,now());
  else
    perform vault.update_secret(v_ids.vault_client_id,p_client_id,v_name||'_client_id','Google OAuth Web Client ID',null);
    perform vault.update_secret(v_ids.vault_client_secret,p_client_secret,v_name||'_client_secret','Google OAuth Web Client Secret',null);
    perform vault.update_secret(v_ids.vault_redirect_uri,p_redirect_uri,v_name||'_redirect_uri','Google OAuth callback URI',null);
    perform vault.update_secret(v_ids.vault_encryption_key,p_encryption_key,v_name||'_encryption_key','Google token AES-256-GCM encryption key',null);
    update public.pac_google_oauth_app_config set updated_by=p_auth_user_id,updated_at=now() where workspace_id=p_workspace_id;
  end if;
  return true;
end;
$function$;

create or replace function public.pac_get_google_oauth_app_config(p_workspace_id uuid)
returns jsonb
language sql security definer set search_path=''
as $function$
  select jsonb_build_object(
    'client_id',ci.decrypted_secret,
    'client_secret',cs.decrypted_secret,
    'redirect_uri',ru.decrypted_secret,
    'encryption_key',ek.decrypted_secret
  )
  from public.pac_google_oauth_app_config c
  join vault.decrypted_secrets ci on ci.id=c.vault_client_id
  join vault.decrypted_secrets cs on cs.id=c.vault_client_secret
  join vault.decrypted_secrets ru on ru.id=c.vault_redirect_uri
  join vault.decrypted_secrets ek on ek.id=c.vault_encryption_key
  where c.workspace_id=p_workspace_id
  limit 1;
$function$;

create or replace function public.pac_store_google_review_worker_secret(p_workspace_id uuid,p_secret text)
returns boolean
language plpgsql security definer set search_path=''
as $function$
declare v_id uuid; v_name text := 'prime_auto_care_review_worker_' || replace(p_workspace_id::text,'-','');
begin
  if length(coalesce(p_secret,''))<32 then raise exception 'WORKER_SECRET_INVALID'; end if;
  select vault_secret_id into v_id from public.pac_google_review_worker_secrets where workspace_id=p_workspace_id for update;
  if v_id is null then
    select id into v_id from vault.create_secret(p_secret,v_name,'Prime Auto Care Google review internal worker authentication secret',null);
    insert into public.pac_google_review_worker_secrets(workspace_id,vault_secret_id) values(p_workspace_id,v_id);
  else
    perform vault.update_secret(v_id,p_secret,v_name,'Prime Auto Care Google review internal worker authentication secret',null);
    update public.pac_google_review_worker_secrets set rotated_at=now() where workspace_id=p_workspace_id;
  end if;
  return true;
end;
$function$;

create or replace function public.pac_get_google_review_worker_secret(p_workspace_id uuid)
returns text
language sql security definer set search_path=''
as $function$
  select d.decrypted_secret
  from public.pac_google_review_worker_secrets s
  join vault.decrypted_secrets d on d.id=s.vault_secret_id
  where s.workspace_id=p_workspace_id
  limit 1;
$function$;

revoke all on function public.pac_store_google_oauth_app_config(uuid,uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.pac_store_google_oauth_app_config(uuid,uuid,text,text,text,text) to service_role;
revoke all on function public.pac_get_google_oauth_app_config(uuid) from public,anon,authenticated;
grant execute on function public.pac_get_google_oauth_app_config(uuid) to service_role;
revoke all on function public.pac_store_google_review_worker_secret(uuid,text) from public,anon,authenticated;
grant execute on function public.pac_store_google_review_worker_secret(uuid,text) to service_role;
revoke all on function public.pac_get_google_review_worker_secret(uuid) from public,anon,authenticated;
grant execute on function public.pac_get_google_review_worker_secret(uuid) to service_role;

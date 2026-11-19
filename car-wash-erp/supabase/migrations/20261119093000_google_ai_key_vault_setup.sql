-- Store the OpenRouter AI provider key in Supabase Vault so the owner can configure AI inside WashDesk.
-- The key is encrypted at rest by Supabase Vault and is never returned to client code.

create table if not exists public.pac_ai_provider_secrets (
  workspace_id uuid not null references public.washdesk_workspaces(id) on delete cascade,
  provider text not null check (provider = 'openrouter'),
  vault_secret_id uuid not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, provider)
);
alter table public.pac_ai_provider_secrets enable row level security;
revoke all on public.pac_ai_provider_secrets from public,anon,authenticated;
grant all on public.pac_ai_provider_secrets to service_role;

create or replace function public.pac_store_openrouter_key(
  p_workspace_id uuid,
  p_auth_user_id uuid,
  p_secret text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner uuid;
  v_secret_id uuid;
  v_name text := 'prime_auto_care_openrouter_' || replace(p_workspace_id::text,'-','');
  v_description text := 'Prime Auto Care WashDesk OpenRouter key; owner-managed; encrypted by Supabase Vault.';
begin
  if length(coalesce(p_secret,'')) < 20 or length(p_secret) > 512 then
    raise exception 'OPENROUTER_KEY_INVALID';
  end if;
  select owner_auth_user_id into v_owner
  from public.washdesk_workspaces where id=p_workspace_id;
  if v_owner is null or v_owner <> p_auth_user_id then
    raise exception 'ORIGINAL_WORKSPACE_OWNER_REQUIRED';
  end if;
  select vault_secret_id into v_secret_id
  from public.pac_ai_provider_secrets
  where workspace_id=p_workspace_id and provider='openrouter'
  for update;
  if v_secret_id is null then
    select vault.create_secret(p_secret,v_name,v_description,null) into v_secret_id;
    insert into public.pac_ai_provider_secrets(workspace_id,provider,vault_secret_id,updated_by,updated_at)
    values(p_workspace_id,'openrouter',v_secret_id,p_auth_user_id,now())
    on conflict(workspace_id,provider) do update
      set vault_secret_id=excluded.vault_secret_id,updated_by=excluded.updated_by,updated_at=now();
  else
    perform vault.update_secret(v_secret_id,p_secret,v_name,v_description,null);
    update public.pac_ai_provider_secrets
      set updated_by=p_auth_user_id,updated_at=now()
      where workspace_id=p_workspace_id and provider='openrouter';
  end if;
  return true;
end;
$function$;

create or replace function public.pac_get_openrouter_key(p_workspace_id uuid)
returns text
language sql
security definer
set search_path = ''
as $function$
  select ds.decrypted_secret
  from public.pac_ai_provider_secrets s
  join vault.decrypted_secrets ds on ds.id=s.vault_secret_id
  where s.workspace_id=p_workspace_id and s.provider='openrouter'
  limit 1;
$function$;

revoke all on function public.pac_store_openrouter_key(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.pac_store_openrouter_key(uuid,uuid,text) to service_role;
revoke all on function public.pac_get_openrouter_key(uuid) from public,anon,authenticated;
grant execute on function public.pac_get_openrouter_key(uuid) to service_role;

comment on table public.pac_ai_provider_secrets is
  'Stores only Vault secret references for AI provider credentials; plaintext keys are never stored in application tables.';

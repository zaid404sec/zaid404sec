-- Google Review Center: one-time secrets are stored in Supabase Vault via the paired owner session.
alter table public.pac_google_review_settings
  add column if not exists google_pubsub_audience text;

create or replace function public.pac_store_google_review_worker_secret(
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
  v_name text := 'prime_auto_care_review_worker_' || replace(p_workspace_id::text, '-', '');
begin
  select owner_auth_user_id
    into v_owner
    from public.washdesk_workspaces
   where id = p_workspace_id;

  if v_owner is null or v_owner <> p_auth_user_id then
    raise exception 'ORIGINAL_WORKSPACE_OWNER_REQUIRED';
  end if;

  if length(coalesce(p_secret, '')) < 32 or length(p_secret) > 512 then
    raise exception 'WORKER_SECRET_INVALID';
  end if;

  select vault_secret_id
    into v_secret_id
    from public.pac_google_review_worker_secrets
   where workspace_id = p_workspace_id
   for update;

  if v_secret_id is null then
    select id
      into v_secret_id
      from vault.create_secret(
        p_secret,
        v_name,
        'Prime Auto Care Google review internal worker authentication secret',
        null
      );

    insert into public.pac_google_review_worker_secrets(workspace_id, vault_secret_id)
    values (p_workspace_id, v_secret_id);
  else
    perform vault.update_secret(
      v_secret_id,
      p_secret,
      v_name,
      'Prime Auto Care Google review internal worker authentication secret',
      null
    );

    update public.pac_google_review_worker_secrets
       set rotated_at = now()
     where workspace_id = p_workspace_id;
  end if;

  return true;
end;
$function$;

revoke all on function public.pac_store_google_review_worker_secret(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.pac_store_google_review_worker_secret(uuid, uuid, text) to service_role;

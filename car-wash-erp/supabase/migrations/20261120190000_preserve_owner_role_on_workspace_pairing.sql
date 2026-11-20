-- Preserve verified Owner roles when a legacy workspace pairing key is used.
-- A fresh Owner install must use the registered Owner sign-in in the app;
-- staff should use the PAC Owner Code from Bookings.
create or replace function public.washdesk_join_workspace(p_pairing_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user uuid := auth.uid();
  v_workspace_id uuid;
  v_owner_user uuid;
  v_code text := upper(regexp_replace(coalesce(p_pairing_code, ''), '\s', '', 'g'));
  v_role text;
  v_business_name text;
  v_existing_workspace uuid;
  v_existing_role text;
begin
  if v_auth_user is null then
    raise exception 'AUTHENTICATION_REQUIRED: Secure device sign-in is required.';
  end if;
  if length(v_code) <> 64 then
    raise exception 'INVALID_PAIRING_CODE: Pairing code must be 64 characters.';
  end if;

  select id, owner_auth_user_id, business_name
    into v_workspace_id, v_owner_user, v_business_name
    from public.washdesk_workspaces
    where pairing_code = v_code
    for update;

  if v_workspace_id is null then
    raise exception 'INVALID_PAIRING_CODE: The pairing code is not valid for this project.';
  end if;

  select workspace_id, role
    into v_existing_workspace, v_existing_role
    from public.washdesk_workspace_members
    where auth_user_id = v_auth_user
    for update;

  if found and v_existing_workspace <> v_workspace_id then
    raise exception 'ALREADY_PAIRED_TO_ANOTHER_WORKSPACE: This account already belongs to a different workspace.';
  end if;

  if v_owner_user is null then
    update public.washdesk_workspaces
      set owner_auth_user_id = v_auth_user
      where id = v_workspace_id;
    v_owner_user := v_auth_user;
  end if;

  v_role := case
    when v_owner_user = v_auth_user or v_existing_role = 'owner' then 'owner'
    else 'member'
  end;

  insert into public.washdesk_workspace_members(auth_user_id, workspace_id, role)
  values (v_auth_user, v_workspace_id, v_role)
  on conflict (auth_user_id) do update
    set workspace_id = excluded.workspace_id,
        role = case
          when public.washdesk_workspace_members.workspace_id = excluded.workspace_id
            and public.washdesk_workspace_members.role = 'owner' then 'owner'
          else excluded.role
        end;

  return jsonb_build_object(
    'workspace_id', v_workspace_id,
    'owner_user_id', v_owner_user,
    'business_name', v_business_name,
    'role', v_role
  );
end;
$$;

create or replace function public.washdesk_can_read_sync(p_owner_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.washdesk_workspace_members m
    join public.washdesk_workspaces w on w.id = m.workspace_id
    where m.auth_user_id = auth.uid()
      and m.role = 'owner'
      and w.owner_auth_user_id = p_owner_user_id
  );
$$;

revoke all on function public.washdesk_join_workspace(text) from public, anon;
revoke all on function public.washdesk_get_workspace() from public, anon;
revoke all on function public.washdesk_can_read_sync(uuid) from public, anon;
grant execute on function public.washdesk_join_workspace(text) to authenticated;
grant execute on function public.washdesk_get_workspace() to authenticated;
grant execute on function public.washdesk_can_read_sync(uuid) to authenticated;

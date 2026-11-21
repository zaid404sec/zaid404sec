-- Prime Auto Care 2.14.2: retain one permanent email/password Owner login.
-- The primary verified account is the only workspace Owner. The former
-- secondary account remains as a Member so its auth history and references
-- are retained. The business data snapshot and canonical owner UUID are not moved.

do $single_owner$
declare
  v_workspace_id uuid;
  v_primary_user_id uuid;
  v_secondary_user_id uuid;
begin
  select id into v_workspace_id
  from public.washdesk_workspaces
  order by created_at limit 1;

  if v_workspace_id is null then
    raise exception 'Prime Auto Care workspace was not found; no owner changes were made.';
  end if;

  select id into v_primary_user_id
  from auth.users
  where lower(email) = 'bmumz3909@gmail.com' and deleted_at is null
  limit 1;

  select id into v_secondary_user_id
  from auth.users
  where lower(email) = 'mz03200786@gmail.com' and deleted_at is null
  limit 1;

  if v_primary_user_id is null then
    raise exception 'The existing primary Owner Auth account was not found; no owner changes were made.';
  end if;

  insert into public.washdesk_workspace_members(auth_user_id, workspace_id, role)
  values (v_primary_user_id, v_workspace_id, 'owner')
  on conflict (auth_user_id) do update
    set workspace_id = excluded.workspace_id, role = 'owner';

  if v_secondary_user_id is not null then
    update public.washdesk_workspace_members
       set role = 'member'
     where auth_user_id = v_secondary_user_id and workspace_id = v_workspace_id;

    update public.pac_booking_notification_admins
       set revoked_at = coalesce(revoked_at, now())
     where auth_user_id = v_secondary_user_id
       and workspace_id = v_workspace_id
       and revoked_at is null;
  end if;
end;
$single_owner$;

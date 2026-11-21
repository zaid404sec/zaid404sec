-- Prime Auto Care 2.14.2: remove Owner privilege from the legacy anonymous
-- install session while preserving its UUID as the canonical snapshot storage key.

do $disable_legacy$
declare
  v_workspace_id uuid;
  v_canonical_owner_id uuid;
  v_primary_owner_id uuid;
begin
  select w.id, w.owner_auth_user_id, p.id
    into v_workspace_id, v_canonical_owner_id, v_primary_owner_id
  from public.washdesk_workspaces w
  join auth.users p
    on lower(p.email) = 'bmumz3909@gmail.com' and p.deleted_at is null
  order by w.created_at limit 1;

  if v_workspace_id is null or v_canonical_owner_id is null or v_primary_owner_id is null then
    raise exception 'Workspace or primary Owner identity could not be verified; no legacy access was changed.';
  end if;

  if v_canonical_owner_id <> v_primary_owner_id then
    update public.washdesk_workspace_members
       set role = 'member'
     where workspace_id = v_workspace_id and auth_user_id = v_canonical_owner_id;

    update public.pac_booking_devices
       set status = 'revoked',
           can_decide_bookings = false,
           revoked_at = coalesce(revoked_at, now())
     where workspace_id = v_workspace_id
       and auth_user_id = v_canonical_owner_id
       and status <> 'revoked';

    update public.pac_booking_notification_admins
       set revoked_at = coalesce(revoked_at, now())
     where workspace_id = v_workspace_id
       and auth_user_id = v_canonical_owner_id
       and revoked_at is null;
  end if;
end;
$disable_legacy$;

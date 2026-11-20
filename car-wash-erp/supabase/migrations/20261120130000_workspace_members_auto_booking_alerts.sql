-- Prime Auto Care: workspace membership automatically enables booking alerts.
-- The workspace join credential is the only enrolment step; no second 8-digit
-- notification code is needed. Existing business records and Owner role are untouched.
create or replace function public.pac_auto_enrol_workspace_member_for_booking_alerts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_owner uuid;
begin
  select owner_auth_user_id
    into v_owner
    from public.washdesk_workspaces
    where id = new.workspace_id;

  if v_owner is null then
    return new;
  end if;

  insert into public.pac_booking_notification_admins (
    workspace_id, auth_user_id, permission, granted_by, granted_at, revoked_at
  ) values (
    new.workspace_id, new.auth_user_id, 'booking_notifications_admin', v_owner, now(), null
  )
  on conflict (workspace_id, auth_user_id) do update
    set permission = excluded.permission,
        granted_by = excluded.granted_by,
        granted_at = now(),
        revoked_at = null;

  return new;
end;
$function$;

revoke all on function public.pac_auto_enrol_workspace_member_for_booking_alerts() from public, anon, authenticated;

drop trigger if exists pac_auto_enrol_workspace_member_booking_alerts
  on public.washdesk_workspace_members;

create trigger pac_auto_enrol_workspace_member_booking_alerts
after insert or update of workspace_id, role
on public.washdesk_workspace_members
for each row
execute function public.pac_auto_enrol_workspace_member_for_booking_alerts();

-- Enable alerts for all devices already enrolled in this workspace.
insert into public.pac_booking_notification_admins (
  workspace_id, auth_user_id, permission, granted_by, granted_at, revoked_at
)
select
  m.workspace_id,
  m.auth_user_id,
  'booking_notifications_admin',
  w.owner_auth_user_id,
  now(),
  null
from public.washdesk_workspace_members m
join public.washdesk_workspaces w on w.id = m.workspace_id
where w.owner_auth_user_id is not null
on conflict (workspace_id, auth_user_id) do update
  set permission = excluded.permission,
      granted_by = excluded.granted_by,
      granted_at = now(),
      revoked_at = null;

comment on function public.pac_auto_enrol_workspace_member_for_booking_alerts() is
  'Automatically enables booking alerts for new or re-paired workspace members.';

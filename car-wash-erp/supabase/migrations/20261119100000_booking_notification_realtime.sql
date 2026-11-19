-- Enable immediate booking alerts for individually authorised paired devices.
create or replace function public.pac_can_receive_booking_alerts(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    exists (
      select 1 from public.washdesk_workspaces w
      where w.id=p_workspace_id and w.owner_auth_user_id=auth.uid()
    )
    or exists (
      select 1 from public.pac_booking_notification_admins a
      where a.workspace_id=p_workspace_id
        and a.auth_user_id=auth.uid()
        and a.permission='booking_notifications_admin'
        and a.revoked_at is null
    );
$function$;
revoke all on function public.pac_can_receive_booking_alerts(uuid) from public,anon;
grant execute on function public.pac_can_receive_booking_alerts(uuid) to authenticated,service_role;

alter table public.pac_booking_notification_events enable row level security;
drop policy if exists pac_booking_notification_events_authorized_realtime_read
  on public.pac_booking_notification_events;
create policy pac_booking_notification_events_authorized_realtime_read
  on public.pac_booking_notification_events
  for select to authenticated
  using (public.pac_can_receive_booking_alerts(workspace_id));
grant select on public.pac_booking_notification_events to authenticated;

do $publication$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='pac_booking_notification_events'
  ) then
    alter publication supabase_realtime add table public.pac_booking_notification_events;
  end if;
end;
$publication$;

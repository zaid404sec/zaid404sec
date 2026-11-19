-- Atomic booking decision + notification event, so a successful accept/reject cannot silently lose its alert.
create or replace function public.pac_update_booking_status_and_notify(
  p_workspace_id uuid,
  p_booking_id uuid,
  p_status text,
  p_status_note text,
  p_actor_user_id uuid,
  p_actor_label text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_booking public.pac_bookings%rowtype;
  v_event_type text;
  v_now timestamptz := now();
begin
  if p_status not in ('confirmed','rejected','cancelled','completed','no_show') then
    raise exception 'INVALID_BOOKING_STATUS';
  end if;

  select * into v_booking
  from public.pac_bookings
  where id = p_booking_id and workspace_id = p_workspace_id
  for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  if p_status in ('confirmed','rejected') and v_booking.status <> 'pending' then
    raise exception 'BOOKING_STATUS_CHANGED';
  elsif p_status = 'cancelled' and v_booking.status not in ('pending','confirmed','rescheduled') then
    raise exception 'BOOKING_STATUS_CHANGED';
  elsif p_status in ('completed','no_show') and v_booking.status not in ('confirmed','rescheduled') then
    raise exception 'BOOKING_STATUS_CHANGED';
  end if;

  update public.pac_bookings
  set status = p_status,
      updated_at = v_now,
      status_note = nullif(left(trim(coalesce(p_status_note,'')),300),''),
      status_changed_by = p_actor_user_id,
      status_changed_by_label = left(coalesce(p_actor_label,''),100),
      status_changed_at = v_now,
      confirmed_at = case when p_status='confirmed' then v_now else confirmed_at end,
      confirmed_by = case when p_status='confirmed' then p_actor_user_id else confirmed_by end,
      rejected_at = case when p_status='rejected' then v_now else rejected_at end,
      rejected_by = case when p_status='rejected' then p_actor_user_id else rejected_by end,
      cancelled_at = case when p_status='cancelled' then v_now else cancelled_at end,
      cancelled_by = case when p_status='cancelled' then p_actor_user_id else cancelled_by end,
      completed_at = case when p_status='completed' then v_now else completed_at end
  where id = p_booking_id and workspace_id = p_workspace_id
  returning * into v_booking;

  v_event_type := case
    when p_status='confirmed' then 'booking_confirmed'
    when p_status='rejected' then 'booking_rejected'
    when p_status='cancelled' then 'booking_cancelled'
    else null
  end;

  if v_event_type is not null then
    insert into public.pac_booking_notification_events(
      workspace_id,booking_id,event_type,booking_code,customer_name,customer_phone,
      vehicle_number,vehicle_type,service_type,booking_date,start_time,is_urgent,
      source,delivery_status,actor_user_id,actor_label
    ) values (
      v_booking.workspace_id,v_booking.id,v_event_type,v_booking.booking_code,
      v_booking.customer_name,v_booking.customer_phone,v_booking.vehicle_number,
      v_booking.vehicle_type,v_booking.service_type,v_booking.booking_date,
      v_booking.start_time,v_booking.is_urgent,v_booking.source,'in_app',
      p_actor_user_id,left(coalesce(p_actor_label,''),100)
    )
    on conflict (workspace_id,booking_id,event_type) do nothing;
  end if;

  return to_jsonb(v_booking);
end;
$function$;

revoke all on function public.pac_update_booking_status_and_notify(uuid,uuid,text,text,uuid,text)
  from public,anon,authenticated;
grant execute on function public.pac_update_booking_status_and_notify(uuid,uuid,text,text,uuid,text)
  to service_role;

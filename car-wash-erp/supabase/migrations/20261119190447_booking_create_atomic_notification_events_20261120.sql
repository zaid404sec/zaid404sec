create or replace function public.pac_create_booking_with_urgency(
  p_workspace_id uuid,
  p_booking_code text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_phone_hash text,
  p_vehicle_number text,
  p_vehicle_type text,
  p_service_type text,
  p_booking_date date,
  p_start_time time without time zone,
  p_duration_minutes integer,
  p_notes text,
  p_source text,
  p_created_by uuid,
  p_is_urgent boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_booking jsonb;
  v_booking_id uuid;
begin
  -- Keep the existing slot-capacity advisory lock and overlap validation.
  v_booking := public.pac_create_booking(
    p_workspace_id, p_booking_code, p_customer_name, p_customer_phone,
    p_customer_phone_hash, p_vehicle_number, p_vehicle_type, p_service_type,
    p_booking_date, p_start_time, p_duration_minutes, p_notes, p_source, p_created_by
  );
  v_booking_id := (v_booking->>'id')::uuid;

  update public.pac_bookings
     set is_urgent = coalesce(p_is_urgent, false), updated_at = now()
   where id = v_booking_id and workspace_id = p_workspace_id;

  -- Create the notification event in the same database transaction as the booking.
  -- The API may upsert this event again for WhatsApp handling; that remains idempotent.
  insert into public.pac_booking_notification_events(
    workspace_id, booking_id, event_type, booking_code, customer_name, customer_phone,
    vehicle_number, vehicle_type, service_type, booking_date, start_time, is_urgent,
    source, delivery_status
  ) values (
    p_workspace_id, v_booking_id, 'booking_created', p_booking_code,
    p_customer_name, p_customer_phone, upper(p_vehicle_number), p_vehicle_type,
    p_service_type, p_booking_date, p_start_time, coalesce(p_is_urgent, false),
    p_source, 'in_app'
  )
  on conflict (workspace_id, booking_id, event_type) do nothing;

  return jsonb_set(v_booking, '{is_urgent}', to_jsonb(coalesce(p_is_urgent, false)), true);
end;
$function$;

revoke all on function public.pac_create_booking_with_urgency(uuid,text,text,text,text,text,text,text,date,time,integer,text,text,uuid,boolean) from public, anon, authenticated;
grant execute on function public.pac_create_booking_with_urgency(uuid,text,text,text,text,text,text,text,date,time,integer,text,text,uuid,boolean) to service_role;

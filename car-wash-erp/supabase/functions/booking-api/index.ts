import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const allowedOrigins = new Set([
  'https://zaid404sec.github.io',
  'https://jkjudmkqaebrgllemris.supabase.co',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
  'http://localhost:8100',
  'http://localhost:5173'
]);

const services = [
  { name: 'Regular Wash', duration_minutes: 30 },
  { name: 'Foam Wash', duration_minutes: 30 },
  { name: 'Wax & Shine', duration_minutes: 60 },
  { name: 'Outside Wash', duration_minutes: 30 }
];
const vehicleTypes = [
  'Private Car',
  'Private SUV',
  'Taxi',
  'Commercial Transport / Traveller',
  'Auto Rickshaw',
  'Other'
];
// Accept the legacy combined category for historical records/imports, but do not offer it for new bookings.
const acceptedVehicleTypes = [...vehicleTypes, 'Private Car / SUV'];

function env(name: string) { return Deno.env.get(name)?.trim() || ''; }
function headersFor(req: Request) {
  const origin = req.headers.get('Origin') || '';
  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headersFor(req), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}
function serviceKey() {
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}');
    return String(keys.default || Object.values(keys)[0] || '');
  } catch { return ''; }
}
function publishableKey() {
  const legacy = env('SUPABASE_ANON_KEY');
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    return String(keys.default || Object.values(keys)[0] || '');
  } catch { return ''; }
}
function adminClient() {
  const url = env('SUPABASE_URL'), key = serviceKey();
  if (!url || !key) throw new Error('Booking backend is not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function parseDate(value: unknown) {
  const date = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid booking date.');
  const parsed = new Date(date + 'T00:00:00Z');
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('Choose a valid booking date.');
  return date;
}
function minutes(value: string) {
  const match = /^(\d{2}):(\d{2})/.exec(String(value || ''));
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}
function timeString(value: number) {
  return String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
}
function durationFor(service: string) {
  const found = services.find(item => item.name === service);
  if (!found) throw new Error('Choose one of the available services.');
  return found.duration_minutes;
}
function normalizePhone(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 13) throw new Error('Enter a valid mobile number with country code if needed.');
  return digits.length === 10 ? '91' + digits : digits;
}
function validateVehicle(value: unknown) {
  const vehicle = String(value || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (vehicle.length < 4 || vehicle.length > 20 || !/^[A-Z0-9 -]+$/.test(vehicle)) throw new Error('Enter a valid vehicle registration number.');
  return vehicle;
}
async function hashPhone(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function authenticate(req: Request) {
  const url = env('SUPABASE_URL'), anon = publishableKey(), admin = adminClient();
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!url || !anon || !token) throw new Error('Sign in to your paired WashDesk workspace first.');
  const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data?.user) throw new Error('Your WashDesk session has expired. Sign in again.');
  const { data: member, error: memberError } = await admin.from('washdesk_workspace_members')
    .select('workspace_id,role').eq('auth_user_id', data.user.id).maybeSingle();
  if (memberError || !member) throw new Error('This device is not paired with the Prime Auto Care workspace.');
  const { data: workspace, error: workspaceError } = await admin.from('washdesk_workspaces')
    .select('id,owner_auth_user_id,business_name').eq('id', member.workspace_id).single();
  if (workspaceError || !workspace) throw new Error('Prime Auto Care workspace could not be verified.');
  return {
    admin,
    user: data.user,
    member,
    workspace,
    isOwner: member.role === 'owner' && workspace.owner_auth_user_id === data.user.id
  };
}
async function canManageBookingNotifications(ctx: any) {
  if (ctx.isOwner) return true;
  const { data, error } = await ctx.admin.from('pac_booking_notification_admins')
    .select('auth_user_id')
    .eq('workspace_id', ctx.workspace.id)
    .eq('auth_user_id', ctx.user.id)
    .eq('permission', 'booking_notifications_admin')
    .is('revoked_at', null)
    .maybeSingle();
  if (error) throw new Error('Booking notification permission could not be verified.');
  return !!data;
}

async function bookingNotificationPairHash(workspaceId: string, code: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(workspaceId + ':' + code));
  return Array.from(new Uint8Array(bytes)).map(value => value.toString(16).padStart(2, '0')).join('');
}
async function createBookingNotificationPairCode(ctx: any) {
  if (!ctx.isOwner) throw new Error('Only the original Workspace Owner can authorise another phone.');
  const random = crypto.getRandomValues(new Uint32Array(1))[0] % 100000000;
  const code = String(random).padStart(8, '0');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const codeHash = await bookingNotificationPairHash(ctx.workspace.id, code);
  const { error: revokeError } = await ctx.admin.from('pac_booking_notification_pair_codes')
    .update({ revoked_at: new Date().toISOString() })
    .eq('workspace_id', ctx.workspace.id).is('redeemed_at', null).is('revoked_at', null);
  if (revokeError) throw new Error('Previous phone pairing codes could not be closed.');
  const { error } = await ctx.admin.from('pac_booking_notification_pair_codes').insert({
    workspace_id: ctx.workspace.id, code_hash: codeHash, created_by: ctx.user.id, expires_at: expiresAt
  });
  if (error) throw new Error('A secure phone pairing code could not be created.');
  return { code, expires_at: expiresAt, expires_in_seconds: 600 };
}
async function redeemBookingNotificationPairCode(ctx: any, value: unknown) {
  const code = String(value || '').replace(/\D/g, '').slice(0, 8);
  if (!/^\d{8}$/.test(code)) throw new Error('Enter the 8-digit code generated on the original Workspace Owner phone.');
  if (ctx.isOwner) return { ok: true, already_authorised: true };
  const codeHash = await bookingNotificationPairHash(ctx.workspace.id, code);
  const now = new Date().toISOString();
  const { data: pair, error: lookupError } = await ctx.admin.from('pac_booking_notification_pair_codes')
    .select('id,created_by,expires_at')
    .eq('workspace_id', ctx.workspace.id).eq('code_hash', codeHash)
    .is('redeemed_at', null).is('revoked_at', null).gt('expires_at', now).maybeSingle();
  if (lookupError) throw new Error('Phone pairing could not be checked. Try again.');
  if (!pair) throw new Error('This code is invalid, expired or already used. Generate a new code on the owner phone.');
  const { data: claimed, error: claimError } = await ctx.admin.from('pac_booking_notification_pair_codes')
    .update({ redeemed_by: ctx.user.id, redeemed_at: now })
    .eq('id', pair.id).is('redeemed_at', null).is('revoked_at', null)
    .gt('expires_at', now).select('id').maybeSingle();
  if (claimError || !claimed) throw new Error('This code was already used. Generate a new code on the owner phone.');
  const { error: grantError } = await ctx.admin.from('pac_booking_notification_admins').upsert({
    workspace_id: ctx.workspace.id, auth_user_id: ctx.user.id,
    permission: 'booking_notifications_admin', granted_by: pair.created_by,
    granted_at: now, revoked_at: null
  }, { onConflict: 'workspace_id,auth_user_id' });
  if (grantError) throw new Error('The phone was paired, but booking-alert permission could not be saved. Contact the owner.');
  return { ok: true, authorised: true };
}
async function publicSettings(admin: any, slug: string) {
  const { data, error } = await admin.from('pac_booking_settings').select('*').eq('public_slug', slug).maybeSingle();
  if (error) throw error;
  if (!data || !data.public_enabled) throw new Error('Online booking is temporarily unavailable. Please call Prime Auto Care.');
  return data;
}
async function createBooking(admin: any, settings: any, input: any, source: 'public' | 'staff', userId: string | null) {
  if (source === 'public' && String(input.website || '').trim()) throw new Error('Booking request could not be accepted.');
  const name = String(input.customer_name || '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) throw new Error('Enter the customer name.');
  const phone = normalizePhone(input.customer_phone);
  const vehicle = validateVehicle(input.vehicle_number);
  const vehicleType = String(input.vehicle_type || '').trim();
  if (!acceptedVehicleTypes.includes(vehicleType)) throw new Error('Choose a valid vehicle category.');
  const service = String(input.service_type || '').trim();
  const duration = durationFor(service);
  const bookingDate = parseDate(input.booking_date);
  const startTime = String(input.start_time || '');
  if (!/^\d{2}:\d{2}$/.test(startTime)) throw new Error('Choose an available time slot.');
  const notes = String(input.notes || '').trim().slice(0, 600);
  const bookingCode = 'PAC-' + bookingDate.replace(/-/g, '') + '-' +
    Array.from(crypto.getRandomValues(new Uint8Array(3))).map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  const phoneHash = await hashPhone(phone);
  const { data, error } = await admin.rpc('pac_create_booking_with_urgency', {
    p_workspace_id: settings.workspace_id,
    p_booking_code: bookingCode,
    p_customer_name: name,
    p_customer_phone: phone,
    p_customer_phone_hash: phoneHash,
    p_vehicle_number: vehicle,
    p_vehicle_type: vehicleType,
    p_service_type: service,
    p_booking_date: bookingDate,
    p_start_time: startTime,
    p_duration_minutes: duration,
    p_notes: notes,
    p_source: source,
    p_created_by: userId,
    p_is_urgent: input.is_urgent === true
  });
  if (error) throw new Error(error.message || 'This time slot is no longer available. Choose another time.');
  await recordBookingCreated(admin, settings, data, {
    customer_name: name, customer_phone: phone, vehicle_number: vehicle,
    vehicle_type: vehicleType, service_type: service, booking_date: bookingDate,
    start_time: startTime, is_urgent: input.is_urgent === true, source
  });
  return data;
}
async function recordBookingCreated(admin: any, settings: any, booking: any, details: any) {
  if (!booking?.id) return;
  const event = {
    workspace_id: settings.workspace_id,
    booking_id: booking.id,
    event_type: 'booking_created',
    booking_code: String(booking.booking_code || ''),
    customer_name: String(details.customer_name || ''),
    customer_phone: String(details.customer_phone || ''),
    vehicle_number: String(details.vehicle_number || ''),
    vehicle_type: String(details.vehicle_type || ''),
    service_type: String(details.service_type || ''),
    booking_date: String(details.booking_date || ''),
    start_time: String(details.start_time || ''),
    is_urgent: details.is_urgent === true,
    source: details.source === 'staff' ? 'staff' : 'public',
    delivery_status: 'in_app'
  };
  const { data: notification, error } = await admin.from('pac_booking_notification_events')
    .upsert(event, { onConflict: 'workspace_id,booking_id,event_type' })
    .select('id').single();
  if (error) {
    console.error('Booking was created, but its in-app notification could not be saved:', error.message);
    return;
  }
  const target = String(settings.notification_phone || '').trim();
  const template = String(settings.notification_whatsapp_template || '').trim();
  if (settings.notification_channel !== 'whatsapp' || !target || !template) return;
  try {
    const { data: provider } = await admin.from('pac_communication_settings')
      .select('whatsapp_phone_number_id,whatsapp_language')
      .eq('workspace_id', settings.workspace_id).maybeSingle();
    if (!provider?.whatsapp_phone_number_id) return;
    const phone = normalizePhone(target);
    const urgentLabel = details.is_urgent === true ? 'URGENT BOOKING' : 'New booking request';
    const message = [
      urgentLabel + ' · Prime Auto Care',
      'Ref: ' + String(booking.booking_code || ''),
      'Customer: ' + details.customer_name,
      'Mobile: ' + details.customer_phone,
      'Vehicle: ' + details.vehicle_number + ' · ' + details.vehicle_type,
      'Service: ' + details.service_type,
      'Date/time: ' + details.booking_date + ' ' + details.start_time,
      'Source: ' + (details.source === 'staff' ? 'Staff / phone booking' : 'Customer website'),
      'Status: Pending — confirm in WashDesk'
    ].join('\n');
    const { data: job, error: jobError } = await admin.from('pac_communication_jobs').insert({
      workspace_id: settings.workspace_id,
      campaign_id: null,
      customer_id: null,
      channel: 'whatsapp',
      purpose: 'service',
      recipient_e164: phone,
      recipient_name: 'Prime Auto Care',
      status: 'queued',
      payload: {
        template_name: template,
        language: String(provider.whatsapp_language || 'en'),
        message
      },
      idempotency_key: 'booking-alert:' + String(booking.id),
      attempts: 0,
      max_attempts: 5,
      scheduled_at: new Date().toISOString()
    }).select('id').single();
    if (jobError) throw jobError;
    await admin.from('pac_booking_notification_events').update({
      delivery_status: 'queued', communication_job_id: job.id
    }).eq('id', notification.id);
  } catch (notifyError) {
    console.error('Booking saved; WhatsApp owner alert was not queued:', notifyError instanceof Error ? notifyError.message : 'unknown');
    await admin.from('pac_booking_notification_events').update({ delivery_status: 'failed' }).eq('id', notification.id);
  }
}

async function slotsFor(admin: any, settings: any, dateValue: unknown, serviceValue: unknown) {
  const date = parseDate(dateValue);
  const duration = durationFor(String(serviceValue || ''));
  const localToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: settings.timezone || 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
  const maxDate = new Date(localToday + 'T00:00:00Z');
  maxDate.setUTCDate(maxDate.getUTCDate() + Number(settings.horizon_days || 14));
  const maxKey = maxDate.toISOString().slice(0, 10);
  if (date < localToday || date > maxKey) return { date, available_slots: [] };
  const { data: rows, error } = await admin.from('pac_bookings')
    .select('start_time,duration_minutes,status')
    .eq('workspace_id', settings.workspace_id)
    .eq('booking_date', date);
  if (error) throw error;
  const active = (rows || []).filter((row: any) => ['pending', 'confirmed', 'rescheduled'].includes(row.status));
  const open = minutes(String(settings.opening_time || '08:00'));
  const close = minutes(String(settings.closing_time || '19:00'));
  const step = Number(settings.slot_minutes || 30);
  const capacity = Number(settings.slot_capacity || 1);
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: settings.timezone || 'Asia/Kolkata',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).format(new Date());
  const currentMinute = minutes(timeParts);
  const available: string[] = [];
  for (let start = open; start + duration <= close; start += step) {
    if (date === localToday && start <= currentMinute) continue;
    const overlaps = active.filter((row: any) => {
      const oldStart = minutes(String(row.start_time || ''));
      const oldEnd = oldStart + Number(row.duration_minutes || 30);
      return oldStart < start + duration && oldEnd > start;
    }).length;
    if (overlaps < capacity) available.push(timeString(start));
  }
  return { date, available_slots: available };
}
async function handle(req: Request, body: any) {
  const action = String(body.action || '');
  const admin = adminClient();
  if (action === 'public-config') {
    const settings = await publicSettings(admin, String(body.slug || 'prime-auto-care'));
    const { data: workspace, error } = await admin.from('washdesk_workspaces')
      .select('business_name').eq('id', settings.workspace_id).single();
    if (error) throw error;
    return {
      business_name: workspace.business_name || 'Prime Auto Care',
      settings: {
        timezone: settings.timezone,
        opening_time: String(settings.opening_time).slice(0, 5),
        closing_time: String(settings.closing_time).slice(0, 5),
        slot_minutes: settings.slot_minutes,
        horizon_days: settings.horizon_days,
        contact_phone: settings.contact_phone
      },
      services,
      vehicle_types: vehicleTypes
    };
  }
  if (action === 'availability') {
    const settings = await publicSettings(admin, String(body.slug || 'prime-auto-care'));
    return await slotsFor(admin, settings, body.date, body.service_type);
  }
  if (action === 'create-public') {
    const settings = await publicSettings(admin, String(body.slug || 'prime-auto-care'));
    const booking = await createBooking(admin, settings, body.booking || {}, 'public', null);
    return { ok: true, booking, message: 'Your request is received. Prime Auto Care will confirm the appointment shortly.' };
  }

  const ctx = await authenticate(req);
  if (action === 'create-notification-pair-code') {
    return await createBookingNotificationPairCode(ctx);
  }
  if (action === 'redeem-notification-pair-code') {
    return await redeemBookingNotificationPairCode(ctx, body.code);
  }
  if (action === 'revoke-notification-device') {
    if (!ctx.isOwner) throw new Error('Only the original Workspace Owner can remove booking-alert access.');
    const target = String(body.user_id || '');
    if (!/^[0-9a-f-]{36}$/i.test(target) || target === ctx.user.id) throw new Error('Select a valid non-owner device.');
    const { error } = await ctx.admin.from('pac_booking_notification_admins').update({ revoked_at: new Date().toISOString() })
      .eq('workspace_id', ctx.workspace.id).eq('auth_user_id', target).is('revoked_at', null);
    if (error) throw new Error('Booking-alert access could not be revoked.');
    return { ok: true };
  }
  if (action === 'notifications') {
    if (!(await canManageBookingNotifications(ctx))) throw new Error('This phone is not authorised to receive Prime Auto Care booking alerts. Ask the owner for a one-time pairing code.');
    const { data: receipts, error: receiptError } = await ctx.admin.from('pac_booking_notification_receipts')
      .select('notification_id').eq('workspace_id', ctx.workspace.id).eq('auth_user_id', ctx.user.id);
    if (receiptError) throw new Error('This phone\'s booking notification receipts could not be read.');
    const acknowledged = new Set((receipts || []).map((row: any) => String(row.notification_id)));
    const { data, error } = await ctx.admin.from('pac_booking_notification_events')
      .select('id,booking_id,event_type,booking_code,customer_name,customer_phone,vehicle_number,vehicle_type,service_type,booking_date,start_time,is_urgent,source,actor_label,created_at')
      .eq('workspace_id', ctx.workspace.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return { notifications: (data || []).filter((item: any) => !acknowledged.has(String(item.id))).slice(0, 20) };
  }
  if (action === 'acknowledge-notification') {
    if (!(await canManageBookingNotifications(ctx))) throw new Error('This phone is not authorised to acknowledge Prime Auto Care booking alerts.');
    const id = String(body.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Select a valid booking notification.');
    const { data: event, error: eventError } = await ctx.admin.from('pac_booking_notification_events')
      .select('id').eq('workspace_id', ctx.workspace.id).eq('id', id).maybeSingle();
    if (eventError || !event) throw new Error('Booking notification was not found in this workspace.');
    const { error } = await ctx.admin.from('pac_booking_notification_receipts').upsert({
      workspace_id: ctx.workspace.id, notification_id: id, auth_user_id: ctx.user.id
    }, { onConflict: 'notification_id,auth_user_id' });
    if (error) throw new Error('This phone\'s notification receipt could not be saved. The alert will remain pending.');
    return { ok: true, device_acknowledged: true };
  }
  if (action === 'list') {
    let query = ctx.admin.from('pac_bookings').select('*')
      .eq('workspace_id', ctx.workspace.id)
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(300);
    if (body.from_date) query = query.gte('booking_date', parseDate(body.from_date));
    if (body.to_date) query = query.lte('booking_date', parseDate(body.to_date));
    if (body.status && ['pending','confirmed','rescheduled','cancelled','completed','no_show','rejected'].includes(String(body.status))) {
      query = query.eq('status', String(body.status));
    }
    if (body.vehicle_type && acceptedVehicleTypes.includes(String(body.vehicle_type))) query = query.eq('vehicle_type', String(body.vehicle_type));
    if (body.service_type && ['Regular Wash','Foam Wash','Wax & Shine','Outside Wash'].includes(String(body.service_type))) query = query.eq('service_type', String(body.service_type));
    if (body.is_urgent === true || body.is_urgent === false) query = query.eq('is_urgent', body.is_urgent);
    const search = String(body.search || '').replace(/[^a-zA-Z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (search.length >= 2) {
      const pattern = '%' + search + '%';
      query = query.or('customer_name.ilike.' + pattern + ',customer_phone.ilike.' + pattern + ',vehicle_number.ilike.' + pattern + ',booking_code.ilike.' + pattern);
    }
    const { data, error } = await query;
    if (error) throw error;
    const { data: settings, error: settingsError } = await ctx.admin.from('pac_booking_settings')
      .select('*').eq('workspace_id', ctx.workspace.id).single();
    if (settingsError) throw settingsError;
    const visibleSettings = ctx.isOwner ? settings : {
      timezone: settings.timezone, opening_time: settings.opening_time, closing_time: settings.closing_time,
      slot_minutes: settings.slot_minutes, slot_capacity: settings.slot_capacity,
      horizon_days: settings.horizon_days, public_enabled: settings.public_enabled
    };
    return { bookings: data || [], settings: visibleSettings, permissions: { is_owner: ctx.isOwner } };
  }
  if (action === 'create-staff') {
    const settingsResult = await ctx.admin.from('pac_booking_settings').select('*').eq('workspace_id', ctx.workspace.id).single();
    if (settingsResult.error) throw settingsResult.error;
    const booking = await createBooking(ctx.admin, settingsResult.data, body.booking || {}, 'staff', ctx.user.id);
    return { ok: true, booking };
  }
  if (action === 'update-status') {
    const allowed = new Set(['confirmed', 'rejected', 'cancelled', 'completed', 'no_show']);
    const status = String(body.status || '');
    const id = String(body.id || '');
    if (!allowed.has(status) || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid booking update.');

    // The database function locks the booking row, enforces allowed status transitions,
    // attributes the actor, and inserts the corresponding per-device notification event
    // in the same transaction. This prevents a successful accept/reject with no alert.
    const { data, error } = await ctx.admin.rpc('pac_update_booking_status_and_notify', {
      p_workspace_id: ctx.workspace.id,
      p_booking_id: id,
      p_status: status,
      p_status_note: String(body.status_note || '').trim().slice(0, 300),
      p_actor_user_id: ctx.user.id,
      p_actor_label: String(ctx.user.email || 'WashDesk user').slice(0, 100)
    });
    if (error) {
      const message = String(error.message || '');
      if (message.includes('BOOKING_STATUS_CHANGED')) throw new Error('Booking status changed on another phone. Refresh the list before trying again.');
      if (message.includes('BOOKING_NOT_FOUND')) throw new Error('Booking was not found in this workspace.');
      throw new Error(message || 'Booking update failed.');
    }
    return { ok: true, booking: data };
  }
  if (action === 'save-settings') {
    if (!ctx.isOwner) throw new Error('Only the original Workspace Owner can change public booking settings.');
    const input = body.settings || {};
    const opening = String(input.opening_time || '08:00');
    const closing = String(input.closing_time || '19:00');
    const slot = Number(input.slot_minutes || 30);
    const capacity = Number(input.slot_capacity || 1);
    const horizon = Number(input.horizon_days || 14);
    const notificationChannel = String(input.notification_channel || 'in_app');
    const notificationPhone = String(input.notification_phone || '').trim();
    const notificationTemplate = String(input.notification_whatsapp_template || '').trim();
    if (!/^\d{2}:\d{2}$/.test(opening) || !/^\d{2}:\d{2}$/.test(closing) ||
        minutes(closing) <= minutes(opening) || ![15, 30, 60].includes(slot) ||
        !Number.isInteger(capacity) || capacity < 1 || capacity > 5 ||
        !Number.isInteger(horizon) || horizon < 1 || horizon > 60) {
      throw new Error('Check the opening hours, slot size, capacity and booking window.');
    }
    if (!['in_app','whatsapp'].includes(notificationChannel)) throw new Error('Choose a valid booking alert channel.');
    if (notificationChannel === 'whatsapp') {
      if (!notificationPhone) throw new Error('Enter the owner mobile number for WhatsApp booking alerts.');
      normalizePhone(notificationPhone);
      if (!/^[a-z0-9_]{3,80}$/i.test(notificationTemplate)) throw new Error('Enter the approved WhatsApp utility template name.');
      const { data: whatsappConfig, error: whatsappConfigError } = await ctx.admin.from('pac_communication_settings')
        .select('whatsapp_phone_number_id').eq('workspace_id', ctx.workspace.id).maybeSingle();
      if (whatsappConfigError) throw new Error('WhatsApp sender configuration could not be checked.');
      if (!whatsappConfig?.whatsapp_phone_number_id || !env('META_ACCESS_TOKEN') || !env('META_GRAPH_API_VERSION')) {
        throw new Error('WhatsApp Cloud API is not configured yet. Keep In-app alerts selected until the sender and server credentials are configured.');
      }
    }
    const { data, error } = await ctx.admin.from('pac_booking_settings').update({
      opening_time: opening, closing_time: closing, slot_minutes: slot,
      slot_capacity: capacity, horizon_days: horizon,
      public_enabled: input.public_enabled === true,
      notification_channel: notificationChannel,
      notification_phone: notificationPhone,
      notification_whatsapp_template: notificationTemplate,
      updated_at: new Date().toISOString()
    }).eq('workspace_id', ctx.workspace.id).select('*').single();
    if (error) throw error;
    return { ok: true, settings: data };
  }
  throw new Error('Unknown booking action.');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('Origin') || '';
    if (origin && !allowedOrigins.has(origin)) return new Response('Origin not allowed.', { status: 403 });
    return new Response('ok', { headers: headersFor(req) });
  }
  if (req.method !== 'POST') return json(req, { error: 'POST required.' }, 405);
  const origin = req.headers.get('Origin') || '';
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: 'Origin not allowed.' }, 403);
  try {
    const body = await req.json().catch(() => ({}));
    return json(req, await handle(req, body));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Booking request failed.';
    const lower = message.toLowerCase();
    const status = lower.includes('slot_unavailable') ? 409
      : lower.includes('rate_limit') ? 429
      : lower.includes('public_booking_disabled') ? 403
      : lower.includes('out_of_range') || lower.includes('invalid_') || lower.includes('choose') || lower.includes('enter') ? 400
      : lower.includes('sign in') || lower.includes('session') || lower.includes('paired') ? 401
      : 500;
    console.error('Booking API request failed:', message);
    return json(req, { error: status >= 500 ? 'Booking service is temporarily unavailable. Please call Prime Auto Care.' : message }, status);
  }
});

import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const allowedOrigins = new Set([
  'https://zaid404sec.github.io',
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
  'Private SUV / 7-Seater',
  'Taxi / Commercial',
  'Transport / Traveller',
  'Auto Rickshaw',
  'Other'
];

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
  if (!vehicleTypes.includes(vehicleType)) throw new Error('Choose a valid vehicle category.');
  const service = String(input.service_type || '').trim();
  const duration = durationFor(service);
  const bookingDate = parseDate(input.booking_date);
  const startTime = String(input.start_time || '');
  if (!/^\d{2}:\d{2}$/.test(startTime)) throw new Error('Choose an available time slot.');
  const notes = String(input.notes || '').trim().slice(0, 600);
  const bookingCode = 'PAC-' + bookingDate.replace(/-/g, '') + '-' +
    Array.from(crypto.getRandomValues(new Uint8Array(3))).map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  const phoneHash = await hashPhone(phone);
  const { data, error } = await admin.rpc('pac_create_booking', {
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
    p_created_by: userId
  });
  if (error) throw new Error(error.message || 'This time slot is no longer available. Choose another time.');
  return data;
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
  if (action === 'list') {
    let query = ctx.admin.from('pac_bookings').select('*')
      .eq('workspace_id', ctx.workspace.id)
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true })
      .limit(300);
    if (body.from_date) query = query.gte('booking_date', parseDate(body.from_date));
    if (body.to_date) query = query.lte('booking_date', parseDate(body.to_date));
    const { data, error } = await query;
    if (error) throw error;
    const { data: settings, error: settingsError } = await ctx.admin.from('pac_booking_settings')
      .select('*').eq('workspace_id', ctx.workspace.id).single();
    if (settingsError) throw settingsError;
    return { bookings: data || [], settings, permissions: { is_owner: ctx.isOwner } };
  }
  if (action === 'create-staff') {
    const settingsResult = await ctx.admin.from('pac_booking_settings').select('*').eq('workspace_id', ctx.workspace.id).single();
    if (settingsResult.error) throw settingsResult.error;
    const booking = await createBooking(ctx.admin, settingsResult.data, body.booking || {}, 'staff', ctx.user.id);
    return { ok: true, booking };
  }
  if (action === 'update-status') {
    const allowed = new Set(['confirmed', 'cancelled', 'completed', 'no_show']);
    const status = String(body.status || '');
    const id = String(body.id || '');
    if (!allowed.has(status) || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Invalid booking update.');
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'confirmed') updates.confirmed_at = new Date().toISOString();
    if (status === 'cancelled') updates.cancelled_at = new Date().toISOString();
    if (status === 'completed') updates.completed_at = new Date().toISOString();
    updates.status_note = String(body.status_note || '').trim().slice(0, 300) || null;
    const { data, error } = await ctx.admin.from('pac_bookings').update(updates)
      .eq('workspace_id', ctx.workspace.id).eq('id', id).select('*').maybeSingle();
    if (error || !data) throw new Error(error?.message || 'Booking not found.');
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
    if (!/^\d{2}:\d{2}$/.test(opening) || !/^\d{2}:\d{2}$/.test(closing) ||
        minutes(closing) <= minutes(opening) || ![15, 30, 60].includes(slot) ||
        !Number.isInteger(capacity) || capacity < 1 || capacity > 5 ||
        !Number.isInteger(horizon) || horizon < 1 || horizon > 60) {
      throw new Error('Check the opening hours, slot size, capacity and booking window.');
    }
    const { data, error } = await ctx.admin.from('pac_booking_settings').update({
      opening_time: opening, closing_time: closing, slot_minutes: slot,
      slot_capacity: capacity, horizon_days: horizon,
      public_enabled: input.public_enabled === true,
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

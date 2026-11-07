import { createClient } from '@supabase/supabase-js';

const CONFIG_KEY = 'washdesk-cloud-config-v1';
let supabase = null;
let user = null;
let channel = null;
let localProvider = null;
let remoteHandler = null;
let pushTimer = null;
let lastPayloadString = '';
let statusText = 'Not connected';
let syncing = false;

function readConfig() { try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}'); } catch { return {}; } }
function setStatus(value) { statusText = value; window.dispatchEvent(new CustomEvent('washdesk-cloud-status', { detail: value })); }
function clone(value) { return JSON.parse(JSON.stringify(value ?? {})); }
function initialize(config) {
  supabase = createClient(config.url, config.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }, realtime: { params: { eventsPerSecond: 8 } } });
}
async function publishPayload(payload) {
  if (!supabase || !user || syncing) return false;
  syncing = true;
  const body = clone(payload);
  const bodyString = JSON.stringify(body);
  const stamp = new Date().toISOString();
  lastPayloadString = bodyString;
  setStatus('Syncing…');
  try {
    const { error } = await supabase.from('washdesk_sync').upsert({ user_id: user.id, payload: body, updated_at: stamp }, { onConflict: 'user_id' });
    if (error) throw error;
    setStatus('Connected · synced just now');
    return true;
  } catch (error) {
    lastPayloadString = '';
    setStatus(navigator.onLine ? 'Sync error · check setup' : 'Offline · changes saved on this device');
    console.error('WashDesk cloud upload failed:', error);
    return false;
  } finally { syncing = false; }
}
function schedulePush(payload) {
  if (!user || !supabase) return;
  const snapshot = clone(payload);
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => publishPayload(snapshot), 850);
}
function listenForChanges() {
  if (!supabase || !user) return;
  if (channel) supabase.removeChannel(channel);
  channel = supabase.channel('washdesk-sync-' + user.id)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'washdesk_sync', filter: 'user_id=eq.' + user.id }, async event => {
      const incoming = event.new?.payload;
      if (!incoming) return;
      const text = JSON.stringify(incoming);
      if (text === lastPayloadString || !remoteHandler) return;
      try {
        const merged = await remoteHandler(incoming);
        if (JSON.stringify(merged) !== text) schedulePush(merged);
        setStatus('Connected · update received');
      } catch (error) { console.error('WashDesk cloud merge failed:', error); setStatus('Cloud update error'); }
    }).subscribe(state => {
      if (state === 'SUBSCRIBED') setStatus('Connected · live sync on');
      else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') setStatus('Reconnecting cloud sync…');
    });
}
async function initialSync() {
  setStatus('Connecting…');
  const { data, error } = await supabase.from('washdesk_sync').select('payload,updated_at').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (data?.payload && remoteHandler) {
    const merged = await remoteHandler(data.payload);
    const mergedText = JSON.stringify(merged);
    if (mergedText !== JSON.stringify(data.payload)) await publishPayload(merged);
    else { lastPayloadString = mergedText; setStatus('Connected · live sync on'); }
  } else if (localProvider) {
    await publishPayload(localProvider());
  }
  listenForChanges();
}

async function connect({ url, anonKey, email, password, mode, getLocal, onRemote }) {
  if (!/^https:\/\//i.test(url || '') || !anonKey || !email || !password) throw new Error('Enter the Supabase project URL, public key, email and password.');
  localProvider = getLocal;
  remoteHandler = onRemote;
  const config = { url: url.trim().replace(/\/$/, ''), anonKey: anonKey.trim() };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  initialize(config);
  setStatus('Signing in…');
  const authResult = mode === 'signup'
    ? await supabase.auth.signUp({ email: email.trim(), password })
    : await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (authResult.error) throw authResult.error;
  if (!authResult.data.session) {
    setStatus('Email verification required');
    return { connected: false, message: 'Account created. Verify the email sent by Supabase, then sign in on this device and the other devices.' };
  }
  user = authResult.data.user;
  await initialSync();
  return { connected: true, message: 'Cloud sync connected. Existing records were merged; new changes sync across signed-in devices.' };
}
async function resume({ getLocal, onRemote }) {
  const config = readConfig();
  if (!config.url || !config.anonKey) return false;
  localProvider = getLocal; remoteHandler = onRemote; initialize(config);
  const { data, error } = await supabase.auth.getSession();
  if (error) { setStatus('Cloud sign-in expired'); return false; }
  if (!data.session) { setStatus('Project saved · sign in on this device'); return false; }
  user = data.session.user;
  try { await initialSync(); return true; }
  catch (error) { console.error('Cloud resume failed:', error); setStatus('Cloud setup incomplete · check SQL setup'); return false; }
}
async function syncNow(payload) {
  if (!supabase || !user) throw new Error('Connect this device to your shared cloud account first.');
  return await publishPayload(payload);
}
async function nextInvoiceNumber({ prefix, date, minNext }) {
  if (!supabase || !user) throw new Error('Cloud counter is not connected.');
  const { data, error } = await supabase.rpc('washdesk_next_invoice_number', { p_prefix: prefix || 'CW', p_date: date, p_min_next_value: Math.max(1, Number(minNext) || 1) });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('The cloud invoice counter returned an invalid number.');
  return data;
}
async function disconnect() {
  clearTimeout(pushTimer);
  if (channel && supabase) await supabase.removeChannel(channel);
  channel = null; user = null; supabase = null; lastPayloadString = '';
  localStorage.removeItem(CONFIG_KEY);
  setStatus('Disconnected · local data remains on this device');
}
window.WashDeskCloud = {
  connect, resume, schedulePush, syncNow, nextInvoiceNumber, disconnect,
  getStatus: () => statusText,
  getConfig: () => readConfig()
};
window.addEventListener('online', () => { if (user && localProvider) schedulePush(localProvider()); });

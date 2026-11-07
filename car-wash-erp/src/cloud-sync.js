import { createClient } from '@supabase/supabase-js';

const CONFIG_KEY = 'washdesk-cloud-config-v1';
const DEFAULT_PROJECT_CONFIG = {
  url: 'https://jkjudmkqaebrgllemris.supabase.co',
  anonKey: 'sb_publishable_VibeDJoJTLelcmlQl8QvhA_kr6h0BQw'
};
let supabase = null;
let user = null;
let channel = null;
let localProvider = null;
let remoteHandler = null;
let pushTimer = null;
let queuedPayload = null;
let lastPayloadString = '';
let statusText = 'Not connected';
let syncing = false;
let pendingEmail = '';
let retryDelay = 1500;

function readConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    return { ...DEFAULT_PROJECT_CONFIG, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch { return { ...DEFAULT_PROJECT_CONFIG }; }
}
function setStatus(value) { statusText = value; window.dispatchEvent(new CustomEvent('washdesk-cloud-status', { detail: value })); }
function clone(value) { return JSON.parse(JSON.stringify(value ?? {})); }
function stableStringify(value) {
  const normalize = input => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === 'object') {
      const ordered = {};
      Object.keys(input).sort().forEach(key => { ordered[key] = normalize(input[key]); });
      return ordered;
    }
    return input;
  };
  return JSON.stringify(normalize(value));
}
function initialize(config) {
  supabase = createClient(config.url, config.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 10 } }
  });
}
function applyRemote(payload) {
  if (!remoteHandler || !payload) return payload;
  return remoteHandler(clone(payload)) || payload;
}
async function publishPayload(payload) {
  if (!supabase || !user) return false;
  if (syncing) { queuedPayload = clone(payload); return false; }
  syncing = true;
  const body = clone(payload);
  setStatus(navigator.onLine ? 'Syncing changes…' : 'Offline · saved on this device');
  try {
    // Server-side row locking and per-record merge prevent concurrent devices
    // from replacing each other's whole-database snapshots.
    const { data, error } = await supabase.rpc('washdesk_merge_sync', { p_payload: body });
    if (error) throw error;
    const canonical = data && typeof data === 'object' ? data : body;
    retryDelay = 1500;
    lastPayloadString = stableStringify(canonical);
    const local = applyRemote(canonical);
    if (stableStringify(local) !== lastPayloadString) queuedPayload = clone(local);
    setStatus('Connected · all changes synced');
    return true;
  } catch (error) {
    queuedPayload = queuedPayload || body;
    const message = String(error?.message || error || '');
    if (message.includes('DUPLICATE_CUSTOMER_MOBILE')) {
      setStatus('Sync blocked · duplicate customer mobile number. Check the customer register on this device.');
      window.dispatchEvent(new CustomEvent('washdesk-cloud-conflict', { detail: 'A mobile number is already assigned to another customer on another device. Resolve the duplicate customer records, then sync again.' }));
    } else if (message.includes('DUPLICATE_VEHICLE_REGISTRATION')) {
      setStatus('Sync blocked · duplicate vehicle registration number. Check the vehicle register on this device.');
      window.dispatchEvent(new CustomEvent('washdesk-cloud-conflict', { detail: 'A vehicle registration number is already saved on another device. Resolve the duplicate vehicle records, then sync again.' }));
    } else {
      setStatus(navigator.onLine ? 'Sync pending · retry when connected' : 'Offline · changes saved on this device');
    }
    console.error('Prime Auto Care cloud upload failed:', error);
    retryDelay = Math.min(Math.max(1500, retryDelay * 2), 60000);
    return false;
  } finally {
    syncing = false;
    if (queuedPayload && user && supabase && navigator.onLine) queueQueuedPush(retryDelay);
  }
}
function queueQueuedPush(delay = 700) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    if (!user || !supabase || syncing || !queuedPayload || !navigator.onLine) return;
    const snapshot = queuedPayload;
    queuedPayload = null;
    await publishPayload(snapshot);
  }, delay);
}
function schedulePush(payload) {
  if (!user || !supabase) return;
  queuedPayload = clone(payload);
  queueQueuedPush(650);
}
function listenForChanges() {
  if (!supabase || !user) return;
  if (channel) supabase.removeChannel(channel);
  channel = supabase.channel('prime-auto-care-sync-' + user.id)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'washdesk_sync',
      filter: 'user_id=eq.' + user.id
    }, event => {
      const incoming = event.new?.payload;
      if (!incoming) return;
      const incomingText = stableStringify(incoming);
      if (incomingText === lastPayloadString || !remoteHandler) return;
      try {
        const merged = applyRemote(incoming);
        if (stableStringify(merged) !== incomingText) schedulePush(merged);
        else setStatus('Connected · update received from another device');
      } catch (error) {
        console.error('Prime Auto Care cloud merge failed:', error);
        setStatus('Cloud update error · local data is safe');
      }
    })
    .subscribe(state => {
      if (state === 'SUBSCRIBED') setStatus('Connected · live sync active');
      else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') setStatus('Reconnecting live sync…');
    });
}
async function initialSync() {
  if (!supabase || !user) throw new Error('Sign in to the shared business account first.');
  setStatus('Checking shared business data…');
  const { data, error } = await supabase.from('washdesk_sync')
    .select('payload,updated_at').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (data?.payload) {
    const merged = applyRemote(data.payload);
    if (stableStringify(merged) !== stableStringify(data.payload)) await publishPayload(merged);
    else {
      lastPayloadString = stableStringify(data.payload);
      setStatus('Connected · live sync active');
    }
  } else if (localProvider) {
    await publishPayload(localProvider());
  }
  listenForChanges();
}
function saveConfig({ url, anonKey, email }) {
  if (!/^https:\/\//i.test(url || '') || !anonKey || !email) {
    throw new Error('Enter the Supabase project URL, public key and shared business email.');
  }
  const config = {
    url: url.trim().replace(/\/$/, ''),
    anonKey: anonKey.trim(),
    email: email.trim().toLowerCase()
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  return config;
}
async function requestEmailOtp({ url, anonKey, email, getLocal, onRemote }) {
  const config = saveConfig({ url, anonKey, email });
  localProvider = getLocal;
  remoteHandler = onRemote;
  initialize(config);
  pendingEmail = config.email;
  setStatus('Sending email sign-in code…');
  const { error } = await supabase.auth.signInWithOtp({
    email: config.email,
    options: { shouldCreateUser: true }
  });
  if (error) { pendingEmail = ''; throw error; }
  setStatus('Email code sent · waiting for verification');
  return { sent: true, email: config.email, message: 'A one-time sign-in code has been sent to ' + config.email + '. Enter that code here to connect this device.' };
}
async function verifyEmailOtp({ email, token, getLocal, onRemote }) {
  const config = readConfig();
  const address = String(email || config.email || '').trim().toLowerCase();
  const code = String(token || '').replace(/\s/g, '');
  if (!config.url || !config.anonKey || !address || !/^\d{6}$/.test(code)) {
    throw new Error('Enter the six-digit email code and check the saved project details.');
  }
  localProvider = getLocal;
  remoteHandler = onRemote;
  initialize(config);
  setStatus('Verifying email code…');
  const { data, error } = await supabase.auth.verifyOtp({ email: address, token: code, type: 'email' });
  if (error) throw error;
  if (!data?.session || !data?.user) throw new Error('The email code was accepted but no signed-in session was returned.');
  user = data.user;
  pendingEmail = '';
  await initialSync();
  return { connected: true, message: 'Prime Auto Care cloud sync is connected. This device has joined the shared business data.' };
}
async function connect({ url, anonKey, email, password, mode, getLocal, onRemote }) {
  // Backward-compatible password sign-in for existing installations.
  if (!/^https:\/\//i.test(url || '') || !anonKey || !email || !password) {
    throw new Error('Enter the Supabase project URL, public key, email and password.');
  }
  const config = saveConfig({ url, anonKey, email });
  localProvider = getLocal; remoteHandler = onRemote; initialize(config);
  setStatus('Signing in…');
  const authResult = mode === 'signup'
    ? await supabase.auth.signUp({ email: config.email, password })
    : await supabase.auth.signInWithPassword({ email: config.email, password });
  if (authResult.error) throw authResult.error;
  if (!authResult.data.session) {
    setStatus('Email verification required');
    return { connected: false, message: 'Verify the email sent by Supabase, then sign in on this device and the other devices.' };
  }
  user = authResult.data.user;
  await initialSync();
  return { connected: true, message: 'Cloud sync connected. Shared records are merged across signed-in devices.' };
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
  catch (error) {
    console.error('Cloud resume failed:', error);
    setStatus('Cloud setup incomplete · check SQL setup');
    return false;
  }
}
async function syncNow(payload) {
  if (!supabase || !user) throw new Error('Connect this device to the shared business account first.');
  return await publishPayload(payload);
}
async function nextInvoiceNumber({ prefix, date, minNext }) {
  if (!supabase || !user) throw new Error('Cloud counter is not connected.');
  const { data, error } = await supabase.rpc('washdesk_next_invoice_number', {
    p_prefix: prefix || 'CW', p_date: date, p_min_next_value: Math.max(1, Number(minNext) || 1)
  });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('The cloud invoice counter returned an invalid number.');
  return data;
}
async function disconnect() {
  clearTimeout(pushTimer);
  if (channel && supabase) await supabase.removeChannel(channel);
  if (supabase) { try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* local data stays available */ } }
  channel = null; user = null; supabase = null; lastPayloadString = ''; queuedPayload = null; pendingEmail = '';
  localStorage.removeItem(CONFIG_KEY);
  setStatus('Disconnected · local business data remains on this device');
}
window.WashDeskCloud = {
  connect, requestEmailOtp, verifyEmailOtp, resume, schedulePush, syncNow, nextInvoiceNumber, disconnect,
  getStatus: () => statusText,
  getConfig: () => readConfig()
};
window.addEventListener('online', () => { retryDelay = 1500; if (user && localProvider) schedulePush(localProvider()); });

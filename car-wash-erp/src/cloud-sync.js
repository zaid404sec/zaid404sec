import { createClient } from '@supabase/supabase-js';

const CONFIG_KEY = 'prime-auto-care-cloud-config-v2';
const WORKSPACE_KEY = 'prime-auto-care-workspace-v2';
const DEFAULT_PROJECT_CONFIG = {
  url: 'https://jkjudmkqaebrgllemris.supabase.co',
  anonKey: 'sb_publishable_VibeDJoJTLelcmlQl8QvhA_kr6h0BQw'
};

let supabase = null;
let activeConfigFingerprint = '';
let user = null;
let workspace = null;
let channel = null;
let localProvider = null;
let remoteHandler = null;
let pushTimer = null;
let queuedPayload = null;
let lastPayloadString = '';
let statusText = 'Not connected';
let syncing = false;
let retryDelay = 1500;
let pollingTimer = null;

function readConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    return { ...DEFAULT_PROJECT_CONFIG, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch {
    return { ...DEFAULT_PROJECT_CONFIG };
  }
}
function readWorkspace() {
  try {
    return JSON.parse(localStorage.getItem(WORKSPACE_KEY) || 'null');
  } catch {
    return null;
  }
}
function setStatus(value) {
  statusText = value;
  window.dispatchEvent(new CustomEvent('washdesk-cloud-status', { detail: value }));
}
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
  const fingerprint = config.url + '|' + config.anonKey;
  if (supabase && activeConfigFingerprint === fingerprint) return;
  if (channel && supabase) void supabase.removeChannel(channel);
  activeConfigFingerprint = fingerprint;
  supabase = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false
    },
    realtime: { params: { eventsPerSecond: 20 } }
  });
}
function saveConfig({ url, anonKey }) {
  if (!/^https:\/\//i.test(url || '') || !anonKey) {
    throw new Error('The prefilled Supabase project URL and publishable key are required.');
  }
  const config = {
    url: url.trim().replace(/\/$/, ''),
    anonKey: anonKey.trim()
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  return config;
}
function normalizeWorkspace(data) {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value?.workspace_id || !value?.owner_user_id) {
    throw new Error('Supabase did not return the shared Prime Auto Care workspace. Run the latest database setup SQL and pair this device again.');
  }
  return {
    workspace_id: value.workspace_id,
    owner_user_id: value.owner_user_id,
    role: value.role || 'member',
    business_name: value.business_name || 'Prime Auto Care'
  };
}
async function ensureSession() {
  if (!supabase) throw new Error('Supabase is not initialized.');
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (data.session?.user) {
    user = data.session.user;
    return user;
  }
  setStatus('Creating secure device session…');
  const { data: signed, error: signError } = await supabase.auth.signInAnonymously();
  if (signError) {
    const message = String(signError.message || signError);
    if (/anonymous.*disabled|anonymous.*not enabled/i.test(message)) {
      throw new Error('Enable Anonymous Sign-Ins once in Supabase: Authentication → Sign In / Providers → Anonymous Sign-Ins. No email or SMTP is needed.');
    }
    throw signError;
  }
  if (!signed?.session || !signed?.user) throw new Error('Supabase did not create a secure device session.');
  user = signed.user;
  return user;
}
async function getWorkspaceFromServer() {
  if (!supabase || !user) return null;
  const { data, error } = await supabase.rpc('washdesk_get_workspace');
  if (error) {
    const message = String(error.message || error);
    if (/function .*washdesk_get_workspace.* does not exist|schema cache/i.test(message)) {
      throw new Error('The shared-workspace SQL has not been installed yet. Run the latest Prime Auto Care cloud-sync SQL file once in Supabase SQL Editor.');
    }
    throw error;
  }
  if (!data) return null;
  return normalizeWorkspace(data);
}
async function pairDevice({ url, anonKey, pairingCode, getLocal, onRemote }) {
  const config = saveConfig({ url, anonKey });
  const code = String(pairingCode || '').replace(/\s/g, '').toUpperCase();
  if (!/^[A-F0-9]{48,80}$/.test(code)) {
    throw new Error('Enter the device pairing code generated at the end of the Supabase SQL setup. It is a long code made of letters A–F and numbers 0–9.');
  }
  localProvider = getLocal;
  remoteHandler = onRemote;
  initialize(config);
  await ensureSession();
  setStatus('Pairing this device with Prime Auto Care…');
  const { data, error } = await supabase.rpc('washdesk_join_workspace', { p_pairing_code: code });
  if (error) {
    const message = String(error.message || error);
    if (/function .*washdesk_join_workspace.* does not exist|schema cache/i.test(message)) {
      throw new Error('The shared-workspace SQL is not installed. Run the latest Prime Auto Care cloud-sync SQL file first.');
    }
    if (/INVALID_PAIRING_CODE/i.test(message)) {
      throw new Error('That device pairing code is incorrect. Copy the complete code from the final SQL Editor result.');
    }
    throw error;
  }
  workspace = normalizeWorkspace(data);
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  await initialSync();
  return {
    connected: true,
    workspace: workspace.business_name,
    role: workspace.role,
    message: 'This device is connected to the shared Prime Auto Care database. Other paired phones and the laptop will receive updates automatically.'
  };
}
function applyRemote(payload) {
  if (!remoteHandler || !payload) return payload;
  return remoteHandler(clone(payload)) || payload;
}
async function publishPayload(payload) {
  if (!supabase || !user || !workspace) return false;
  if (syncing) { queuedPayload = payload; return false; }
  syncing = true;
  const body = clone(payload);
  setStatus(navigator.onLine ? 'Syncing changes…' : 'Offline · saved on this device');
  try {
    const { data, error } = await supabase.rpc('washdesk_merge_sync', { p_payload: body });
    if (error) throw error;
    const canonical = data && typeof data === 'object' ? data : body;
    retryDelay = 1500;
    lastPayloadString = stableStringify(canonical);
    const local = applyRemote(canonical);
    if (stableStringify(local) !== lastPayloadString) queuedPayload = clone(local);
    setStatus('Connected · all devices synced');
    return true;
  } catch (error) {
    queuedPayload = queuedPayload || body;
    const message = String(error?.message || error || '');
    if (message.includes('DUPLICATE_CUSTOMER_MOBILE')) {
      setStatus('Sync blocked · duplicate customer mobile number. Resolve the customer conflict.');
      window.dispatchEvent(new CustomEvent('washdesk-cloud-conflict', { detail: 'A mobile number is assigned to more than one customer across devices. Resolve the duplicate customer records, then sync again.' }));
    } else if (message.includes('DUPLICATE_VEHICLE_REGISTRATION')) {
      setStatus('Sync blocked · duplicate vehicle registration number. Resolve the vehicle conflict.');
      window.dispatchEvent(new CustomEvent('washdesk-cloud-conflict', { detail: 'A vehicle registration number is already saved on another device. Resolve the duplicate vehicle records, then sync again.' }));
    } else {
      setStatus(navigator.onLine ? 'Sync pending · retry when connected' : 'Offline · changes saved on this device');
    }
    console.error('Prime Auto Care cloud upload failed:', error);
    retryDelay = Math.min(Math.max(1500, retryDelay * 2), 60000);
    return false;
  } finally {
    syncing = false;
    if (queuedPayload && user && workspace && supabase && navigator.onLine) queueQueuedPush(retryDelay);
  }
}
function queueQueuedPush(delay = 700) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    if (!user || !workspace || !supabase || syncing || !queuedPayload || !navigator.onLine) return;
    const snapshot = queuedPayload;
    queuedPayload = null;
    await publishPayload(snapshot);
  }, delay);
}
function schedulePush(payload) {
  if (!user || !workspace || !supabase) return;
  // Keep only the latest live DB reference while the debounce timer runs.
  // Serializing/cloning the full business database in every save handler blocks
  // the WebView main thread and makes on-screen typing feel unstable.
  queuedPayload = payload;
  queueQueuedPush(500);
}
function listenForChanges() {
  if (!supabase || !user || !workspace) return;
  if (channel) void supabase.removeChannel(channel);
  channel = supabase.channel('prime-auto-care-workspace-' + workspace.workspace_id)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'washdesk_sync',
      filter: 'user_id=eq.' + workspace.owner_user_id
    }, event => {
      const incoming = event.new?.payload;
      if (!incoming) return;
      const incomingText = stableStringify(incoming);
      if (incomingText === lastPayloadString || !remoteHandler) return;
      try {
        const merged = applyRemote(incoming);
        if (stableStringify(merged) !== incomingText) schedulePush(merged);
        else setStatus('Connected · live update received');
      } catch (error) {
        console.error('Prime Auto Care live update merge failed:', error);
        setStatus('Cloud update error · local data is safe');
      }
    })
    .subscribe(state => {
      if (state === 'SUBSCRIBED') setStatus('Connected · live sync active on all paired devices');
      else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') setStatus('Reconnecting live sync…');
    });
}
async function initialSync() {
  if (!supabase || !user || !workspace) throw new Error('Pair this device with the shared Prime Auto Care business first.');
  setStatus('Loading shared Prime Auto Care data…');
  const { data, error } = await supabase.from('washdesk_sync')
    .select('payload,updated_at')
    .eq('user_id', workspace.owner_user_id)
    .maybeSingle();
  if (error) throw error;
  if (data?.payload) {
    const merged = applyRemote(data.payload);
    if (stableStringify(merged) !== stableStringify(data.payload)) await publishPayload(merged);
    else {
      lastPayloadString = stableStringify(data.payload);
      setStatus('Connected · live sync active on all paired devices');
    }
  } else if (localProvider) {
    await publishPayload(localProvider());
  }
  listenForChanges();
  startSafetyRefresh();
}
function startSafetyRefresh() {
  clearInterval(pollingTimer);
  // Realtime is the primary path. A light 30-second reconciliation also recovers
  // missed events after sleep, network changes, or a temporary socket disconnect.
  pollingTimer = setInterval(async () => {
    if (!navigator.onLine || !user || !workspace || !supabase || syncing) return;
    try {
      const { data, error } = await supabase.from('washdesk_sync')
        .select('payload,updated_at')
        .eq('user_id', workspace.owner_user_id)
        .maybeSingle();
      if (error || !data?.payload) return;
      const incomingText = stableStringify(data.payload);
      if (incomingText === lastPayloadString || !remoteHandler) return;
      const merged = applyRemote(data.payload);
      if (stableStringify(merged) !== incomingText) await publishPayload(merged);
      else {
        lastPayloadString = incomingText;
        setStatus('Connected · live sync active on all paired devices');
      }
    } catch (error) {
      console.warn('Prime Auto Care sync reconciliation:', error);
    }
  }, 30000);
}
async function resume({ getLocal, onRemote }) {
  const config = readConfig();
  if (!config.url || !config.anonKey) return false;
  localProvider = getLocal;
  remoteHandler = onRemote;
  initialize(config);
  const { data, error } = await supabase.auth.getSession();
  if (error) { setStatus('Device session unavailable · pair this device again'); return false; }
  if (!data.session?.user) {
    user = null; workspace = null;
    setStatus('Not connected · enter the shared device pairing code');
    return false;
  }
  user = data.session.user;
  // Restore the last known pairing first. If the app is restarted while offline,
  // the cached workspace mapping lets this device resume cloud sync automatically
  // when network connectivity returns, without asking the user to pair again.
  workspace = readWorkspace();
  try {
    const serverWorkspace = await getWorkspaceFromServer();
    if (serverWorkspace) {
      workspace = serverWorkspace;
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    } else if (!workspace) {
      setStatus('Device signed in · enter the shared pairing code');
      return false;
    }
    await initialSync();
    return true;
  } catch (error) {
    console.error('Prime Auto Care cloud resume failed:', error);
    const message = String(error?.message || error || '');
    if (workspace && !navigator.onLine) {
      setStatus('Offline · shared workspace saved; automatic sync will resume when internet returns');
    } else {
      setStatus(message.includes('washdesk_sync') ? 'Signed in · run the shared database SQL setup' : 'Cloud reconnect needed · retrying when internet returns');
    }
    return false;
  }
}
async function syncNow(payload) {
  if (!supabase || !user || !workspace) throw new Error('Connect this device with the shared device pairing code first.');
  return await publishPayload(payload);
}
async function nextInvoiceNumber({ prefix, date, minNext }) {
  if (!supabase || !user || !workspace) throw new Error('Shared cloud database is not connected.');
  const { data, error } = await supabase.rpc('washdesk_next_invoice_number', {
    p_prefix: prefix || 'CW',
    p_date: date,
    p_min_next_value: Math.max(1, Number(minNext) || 1)
  });
  if (error) throw error;
  if (typeof data !== 'string' || !data) throw new Error('The shared invoice counter returned an invalid number.');
  return data;
}
async function disconnect() {
  clearTimeout(pushTimer);
  clearInterval(pollingTimer);
  if (channel && supabase) await supabase.removeChannel(channel);
  if (supabase) {
    try { await supabase.auth.signOut({ scope: 'local' }); } catch { /* local records stay available */ }
  }
  channel = null;
  user = null;
  workspace = null;
  lastPayloadString = '';
  queuedPayload = null;
  localStorage.removeItem(WORKSPACE_KEY);
  setStatus('This device disconnected · local records remain safe');
}
window.WashDeskCloud = {
  pairDevice,
  resume,
  schedulePush,
  syncNow,
  nextInvoiceNumber,
  disconnect,
  getStatus: () => statusText,
  getConfig: () => readConfig(),
  getWorkspace: () => workspace || readWorkspace()
};
window.addEventListener('online', () => {
  retryDelay = 1500;
  if (user && workspace && localProvider) {
    schedulePush(localProvider());
    if (!channel) void initialSync().catch(error => console.warn('Prime Auto Care cloud reconnect:', error));
  } else if (localProvider && remoteHandler) {
    // Retry session and workspace restoration when the app was opened offline.
    void resume({ getLocal: localProvider, onRemote: remoteHandler }).catch(error => console.warn('Prime Auto Care saved device reconnect:', error));
  }
});

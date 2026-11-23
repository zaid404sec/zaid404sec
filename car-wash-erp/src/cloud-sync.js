import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

const CONFIG_KEY = 'prime-auto-care-cloud-config-v2';
const WORKSPACE_KEY = 'prime-auto-care-workspace-v2';
const OWNER_RECOVERY_REDIRECT = 'primeautocare28://auth-callback';
const REGISTERED_OWNER_EMAIL = 'primeautoconsult@gmail.com';
const REGISTERED_OWNER_EMAILS = new Set([REGISTERED_OWNER_EMAIL]);
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
let lastRemoteUpdatedAt = '';
let statusText = 'Not connected';
let syncing = false;
let retryDelay = 1500;
let schemaBlocked = false;
let stockLedgerSchemaReady = false;
let pollingTimer = null;
let authEventSubscription = null;
let authEventClient = null;
let appUrlListenerPromise = null;
let appStateListenerPromise = null;
let recoveryUiPending = false;

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
  if (supabase && activeConfigFingerprint === fingerprint) {
    installAuthListeners();
    return;
  }
  if (channel && supabase) void supabase.removeChannel(channel);
  authEventSubscription?.unsubscribe?.();
  authEventSubscription = null;
  authEventClient = null;
  activeConfigFingerprint = fingerprint;
  supabase = createClient(config.url, config.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce'
    },
    realtime: { params: { eventsPerSecond: 20 } }
  });
  installAuthListeners();
}
function signalOwnerPasswordRecovery(sessionUser) {
  if (recoveryUiPending) return;
  recoveryUiPending = true;
  setStatus('Password recovery verified · choose a new Owner password');
  window.dispatchEvent(new CustomEvent('washdesk-owner-password-recovery', {
    detail: { email: String(sessionUser?.email || '') }
  }));
}
async function handleOwnerAuthCallback(rawUrl) {
  const callback = new URL(String(rawUrl || ''));
  if (callback.protocol !== 'primeautocare28:' || callback.hostname !== 'auth-callback') return false;
  if (!supabase) initialize(readConfig());
  const code = callback.searchParams.get('code');
  const tokenHash = callback.searchParams.get('token_hash');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
  } else if (tokenHash) {
    const type = callback.searchParams.get('type') || 'recovery';
    if (type !== 'recovery') throw new Error('This is not an Owner password recovery link.');
    const { error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash });
    if (error) throw error;
  } else {
    const fragment = new URLSearchParams(callback.hash.replace(/^#/, ''));
    const accessToken = fragment.get('access_token');
    const refreshToken = fragment.get('refresh_token');
    if (!accessToken || !refreshToken) throw new Error('The recovery link is incomplete or expired. Request a new one from the same phone.');
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
  }
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.user) throw error || new Error('The recovery link did not create a secure session.');
  user = data.session.user;
  signalOwnerPasswordRecovery(user);
  return true;
}
function installAuthListeners() {
  if (!supabase) return;
  if (authEventClient !== supabase) {
    authEventSubscription?.unsubscribe?.();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') signalOwnerPasswordRecovery(session?.user);
    });
    authEventSubscription = data?.subscription || null;
    authEventClient = supabase;
  }
  if (!Capacitor.isNativePlatform()) return;
  if (!appUrlListenerPromise) {
    appUrlListenerPromise = (async () => {
      await App.addListener('appUrlOpen', ({ url }) => {
        void handleOwnerAuthCallback(url).catch(error => {
          const message = String(error?.message || 'The Owner password recovery link could not be opened.');
          setStatus('Owner password recovery failed · request a fresh email link');
          window.dispatchEvent(new CustomEvent('washdesk-owner-password-recovery-error', { detail: message }));
        });
      });
      const launch = await App.getLaunchUrl();
      if (launch?.url) {
        await handleOwnerAuthCallback(launch.url).catch(error => {
          const message = String(error?.message || 'The Owner password recovery link could not be opened.');
          setStatus('Owner password recovery failed · request a fresh email link');
          window.dispatchEvent(new CustomEvent('washdesk-owner-password-recovery-error', { detail: message }));
        });
      }
    })().catch(error => {
      appUrlListenerPromise = null;
      console.warn('Prime Auto Care auth deep-link listener:', error);
    });
  }
  if (!appStateListenerPromise) {
    appStateListenerPromise = App.addListener('appStateChange', state => {
      if (state?.isActive && user && workspace?.role === 'owner' && navigator.onLine) {
        void initialSync().catch(error => console.warn('Prime Auto Care foreground sync:', error));
      }
    }).catch(error => {
      appStateListenerPromise = null;
      console.warn('Prime Auto Care foreground listener:', error);
    });
  }
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
async function pairBookingDevice({ code, deviceLabel, deviceKind }) {
  const config = readConfig();
  initialize(config);
  await ensureSession();
  const cleanCode = String(code || '').replace(/\D/g, '');
  if (!/^\d{8,12}$/.test(cleanCode)) {
    throw new Error('Enter the 8–12 digit PAC Owner Code from the Owner.');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(cleanCode));
  const codeHash = Array.from(new Uint8Array(digest)).map(value => value.toString(16).padStart(2, '0')).join('');
  const kind = deviceKind === 'desktop' ? 'desktop' : 'phone';
  setStatus('Verifying PAC Owner Code…');
  const { data, error } = await supabase.rpc('pac_join_workspace_with_owner_code', {
    p_code_hash: codeHash,
    p_device_label: String(deviceLabel || ''),
    p_device_kind: kind
  });
  if (error) throw new Error(error.message || 'PAC Owner Code verification failed.');
  if (!data?.ok) {
    const message = data?.message || 'PAC Owner Code could not be verified.';
    throw new Error(message);
  }
  workspace = normalizeWorkspace(data);
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  if (workspace.role === 'owner') {
    await initialSync();
  } else {
    clearTimeout(pushTimer);
    clearInterval(pollingTimer);
    if (channel && supabase) await supabase.removeChannel(channel);
    channel = null;
    queuedPayload = null;
    stockLedgerSchemaReady = false;
    schemaBlocked = false;
    lastPayloadString = '';
    lastRemoteUpdatedAt = '';
    setStatus('Connected as booking staff · Bookings only · Accept / Reject enabled');
  }
  return { connected: true, role: workspace.role, workspace: workspace.business_name, device_label: data.device_label || deviceLabel };
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
function ownerSignInFailureStatus(error) {
  const message = String(error?.message || error || '');
  if (/invalid login credentials|invalid email or password/i.test(message)) {
    return 'Owner sign-in failed · check the selected email and Supabase password';
  }
  if (/email not confirmed/i.test(message)) {
    return 'Owner sign-in blocked · confirm the selected Owner email in Supabase Auth';
  }
  if (/failed to fetch|network|timeout|load failed/i.test(message)) {
    return 'Owner sign-in could not reach Supabase · check internet and retry';
  }
  const brief = message.replace(/\s+/g, ' ').trim().slice(0, 120);
  return brief ? `Owner restore failed · ${brief}` : 'Owner restore failed · review the message below';
}
async function signInOwner({ url, anonKey, email, password, getLocal, onRemote }) {
  const config = saveConfig({ url, anonKey });
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPassword = String(password || '');
  if (!REGISTERED_OWNER_EMAILS.has(cleanEmail)) throw new Error('Use the single registered Prime Auto Care Owner email shown on this screen.');
  if (!cleanPassword) throw new Error('Enter the password for the selected Owner email.');
  localProvider = getLocal;
  remoteHandler = onRemote;
  initialize(config);
  setStatus('Signing in to the registered Prime Auto Care Owner account…');
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword
    });
    if (error || !data?.user) {
      throw new Error(error?.message || 'Owner sign-in failed. Check the selected email and password, then try again.');
    }
    user = data.user;
    let serverWorkspace;
    try {
      serverWorkspace = await getWorkspaceFromServer();
    } catch (workspaceError) {
      await supabase.auth.signOut({ scope: 'local' });
      user = null;
      workspace = null;
      throw workspaceError;
    }
    if (!serverWorkspace || serverWorkspace.role !== 'owner') {
      await supabase.auth.signOut({ scope: 'local' });
      user = null;
      workspace = null;
      setStatus('Owner sign-in blocked · selected account is not registered as an Owner');
      throw new Error('This account is not registered as a Prime Auto Care Owner. Select one of the existing Owner accounts.');
    }
    workspace = serverWorkspace;
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    setStatus('Owner verified · restoring shared business data…');
    clearTimeout(pushTimer);
    clearInterval(pollingTimer);
    if (channel && supabase) await supabase.removeChannel(channel);
    channel = null;
    queuedPayload = null;
    stockLedgerSchemaReady = false;
    schemaBlocked = false;
    lastPayloadString = '';
    lastRemoteUpdatedAt = '';
    await initialSync();
    return {
      connected: true,
      workspace: workspace.business_name,
      role: 'owner',
      message: 'Owner account verified. Your full Prime Auto Care business app and shared cloud data are restored on this device.'
    };
  } catch (error) {
    if (statusText.startsWith('Signing in to the registered') ||
        statusText.startsWith('Owner verified · restoring shared business data')) {
      setStatus(ownerSignInFailureStatus(error));
    }
    throw error;
  }
}

async function requestOwnerPasswordRecovery({ email }) {
  initialize(readConfig());
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Open Prime Auto Care on the Android phone that will receive the recovery link.');
  }
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!REGISTERED_OWNER_EMAILS.has(cleanEmail)) {
    throw new Error('Use the single registered Prime Auto Care Owner email shown on this screen.');
  }
  recoveryUiPending = false;
  setStatus('Requesting a secure Owner password reset email…');
  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: OWNER_RECOVERY_REDIRECT
  });
  if (error) {
    const message = String(error.message || error);
    if (/redirect_to|redirect url|not allowed/i.test(message)) {
      throw new Error('One-time setup is required: in Supabase Authentication → URL Configuration → Redirect URLs, add exactly ' + OWNER_RECOVERY_REDIRECT + ' and save. Then request the recovery email again.');
    }
    throw error;
  }
  setStatus('Owner password recovery email requested · open the link on this same phone');
  return { sent: true, email: cleanEmail };
}
async function completeOwnerPasswordRecovery({ password, getLocal, onRemote }) {
  if (!supabase) initialize(readConfig());
  const cleanPassword = String(password || '');
  if (cleanPassword.length < 8) throw new Error('Choose a password with at least 8 characters.');
  localProvider = getLocal;
  remoteHandler = onRemote;
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData?.session?.user) {
    throw sessionError || new Error('The recovery session expired. Request a new password-reset email from this phone.');
  }
  user = sessionData.session.user;
  if (!REGISTERED_OWNER_EMAILS.has(String(user.email || '').trim().toLowerCase())) {
    throw new Error('This recovery link does not belong to the registered Prime Auto Care Owner account.');
  }
  const serverWorkspace = await getWorkspaceFromServer();
  if (!serverWorkspace || serverWorkspace.role !== 'owner') {
    throw new Error('This recovery session is not linked to a registered Prime Auto Care Owner account. No password was changed.');
  }
  const { data, error } = await supabase.auth.updateUser({ password: cleanPassword });
  if (error) throw error;
  user = data?.user || user;
  workspace = serverWorkspace;
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
  clearTimeout(pushTimer);
  clearInterval(pollingTimer);
  if (channel && supabase) await supabase.removeChannel(channel);
  channel = null;
  queuedPayload = null;
  lastPayloadString = '';
  lastRemoteUpdatedAt = '';
  schemaBlocked = false;
  stockLedgerSchemaReady = false;
  recoveryUiPending = false;
  await initialSync();
  return {
    connected: true,
    role: 'owner',
    workspace: workspace.business_name,
    message: 'Owner password updated. Your full Prime Auto Care business app and shared cloud data are restored.'
  };
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
  if (workspace.role === 'owner') {
    await initialSync();
  } else {
    clearTimeout(pushTimer);
    clearInterval(pollingTimer);
    if (channel && supabase) await supabase.removeChannel(channel);
    channel = null;
    queuedPayload = null;
    stockLedgerSchemaReady = false;
    schemaBlocked = false;
    lastPayloadString = '';
    lastRemoteUpdatedAt = '';
    setStatus('Connected as booking staff · Bookings only · Accept / Reject enabled');
  }
  return {
    connected: true,
    workspace: workspace.business_name,
    role: workspace.role,
    message: workspace.role === 'owner'
      ? 'This device is connected as an Owner. All business features and live sync are enabled.'
      : 'This device is connected as booking staff. Only Bookings and Accept / Reject are available.'
  };
}
function applyRemote(payload) {
  if (!remoteHandler || !payload) return payload;
  const applied = remoteHandler(payload);
  if (applied?.__cloudSyncDeferred) return null;
  return applied || payload;
}
async function refreshStockLedgerSchemaStatus() {
  if (!supabase || !user || !workspace) throw new Error('Connect this device with the shared pairing code first.');
  const { data, error } = await supabase.rpc('washdesk_get_stock_ledger_version');
  if (error || Number(data) !== 1) {
    stockLedgerSchemaReady = false;
    schemaBlocked = true;
    setStatus('Cloud SQL update required · no stock or invoice writes will be sent until the updated SQL is installed.');
    throw new Error('CLOUD_SCHEMA_UPDATE_REQUIRED');
  }
  stockLedgerSchemaReady = true;
  schemaBlocked = false;
  return true;
}
async function publishPayload(payload) {
  if (!supabase || !user || !workspace) return false;
  if (workspace.role !== 'owner') {
    setStatus('Booking staff accounts cannot sync business records.');
    return false;
  }
  if (!stockLedgerSchemaReady || schemaBlocked) {
    queuedPayload = payload;
    setStatus('Cloud SQL update required · local changes are saved; no cloud write was attempted.');
    return false;
  }
  if (syncing) { queuedPayload = payload; return false; }
  // Avoid cloning and uploading an unchanged full-workspace snapshot.
  const payloadText = stableStringify(payload);
  if (payloadText === lastPayloadString) { queuedPayload = null; return true; }
  syncing = true;
  const body = clone(payload);
  setStatus(navigator.onLine ? 'Syncing changes…' : 'Offline · saved on this device');
  try {
    const { data, error } = await supabase.rpc('washdesk_merge_sync', { p_payload: body });
    if (error) throw error;
    const canonical = data && typeof data === 'object' ? data : body;
    if (Number(canonical?.meta?.serverStockLedgerVersion) !== 1) {
      const schemaError = new Error('CLOUD_SCHEMA_UPDATE_REQUIRED');
      schemaError.code = 'CLOUD_SCHEMA_UPDATE_REQUIRED';
      throw schemaError;
    }
    schemaBlocked = false;
    stockLedgerSchemaReady = true;
    retryDelay = 1500;
    lastPayloadString = stableStringify(canonical);
    // Store the database timestamp, not the client clock, so the lightweight
    // version check does not repeatedly download an unchanged full payload.
    try {
      const { data: marker } = await supabase.from('washdesk_sync').select('updated_at')
        .eq('user_id', workspace.owner_user_id).maybeSingle();
      lastRemoteUpdatedAt = String(marker?.updated_at || '');
    } catch { lastRemoteUpdatedAt = ''; }
    const local = applyRemote(canonical);
    if (local && stableStringify(local) !== lastPayloadString) queuedPayload = local;
    setStatus('Connected · all devices synced');
    return true;
  } catch (error) {
    queuedPayload = queuedPayload || body;
    const message = String(error?.message || error || '');
    if (message.includes('CLOUD_SCHEMA_UPDATE_REQUIRED')) {
      schemaBlocked = true;
      stockLedgerSchemaReady = false;
      queuedPayload = body;
      clearTimeout(pushTimer);
      setStatus('Cloud SQL update required · open Business settings and run the latest Cloud Sync SQL file once.');
      window.dispatchEvent(new CustomEvent('washdesk-cloud-conflict', { detail: 'Cloud inventory protection is not enabled yet. Run the latest Prime Auto Care Cloud Sync SQL file once in Supabase SQL Editor, then tap Sync now.' }));
    } else if (message.includes('APP_UPDATE_REQUIRED')) {
      schemaBlocked = true;
      stockLedgerSchemaReady = false;
      queuedPayload = body;
      clearTimeout(pushTimer);
      setStatus('App update required · update every paired device to Prime Auto Care 2.5.2 or later before syncing.');
      window.dispatchEvent(new CustomEvent('washdesk-cloud-conflict', { detail: 'This device is using an older Prime Auto Care build. Update every paired phone and computer to version 2.5.2 before syncing stock changes.' }));
    } else if (message.includes('INSUFFICIENT_STOCK')) {
      schemaBlocked = true;
      queuedPayload = body;
      clearTimeout(pushTimer);
      setStatus('Stock conflict · this device has a pending change that would make shared stock negative.');
      window.dispatchEvent(new CustomEvent('washdesk-cloud-conflict', { detail: 'A stock change could not be accepted because the combined shared stock would become negative. Review the pending bill or stock adjustment on the device that created it before syncing again.' }));
    } else if (message.includes('DUPLICATE_CUSTOMER_MOBILE')) {
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
    if (schemaBlocked || !user || !workspace || !supabase || syncing || !queuedPayload || !navigator.onLine) return;
    const snapshot = queuedPayload;
    queuedPayload = null;
    await publishPayload(snapshot);
  }, delay);
}
function schedulePush(payload) {
  if (!user || !workspace || !supabase || workspace.role !== 'owner') return;
  // Keep the local snapshot queued, but do not send it until the new SQL version is verified.
  if (schemaBlocked || !stockLedgerSchemaReady) { queuedPayload = payload; return; }
  // Keep only the latest live DB reference while the debounce timer runs.
  // Serializing/cloning the full business database in every save handler blocks
  // the WebView main thread and makes on-screen typing feel unstable.
  // Keep a single live reference and debounce the snapshot once per edit burst.
  queuedPayload = payload;
  queueQueuedPush(1000);
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
      if (event.new?.updated_at) lastRemoteUpdatedAt = String(event.new.updated_at);
      if (!incoming || !remoteHandler) return;
      try {
        const incomingText = stableStringify(incoming);
        if (incomingText === lastPayloadString) return;
        // Keep the current form stable while still applying updates immediately
        // on screens where there is no active edit or modal.
        const merged = applyRemote(incoming);
        if (!merged) {
          setStatus('Connected · update queued until you leave the current screen');
          return;
        }
        if (stableStringify(merged) !== incomingText) schedulePush(merged);
        else setStatus('Connected · live update received');
      } catch (error) {
        console.error('Prime Auto Care live update merge failed:', error);
        setStatus('Cloud update error · local data is safe');
      }
    })
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'pac_booking_notification_events',
      filter: 'workspace_id=eq.' + workspace.workspace_id
    }, event => {
      if (!event.new?.id) return;
      window.dispatchEvent(new CustomEvent('washdesk-booking-notification', { detail: event.new }));
    })
    .subscribe(state => {
      if (state === 'SUBSCRIBED') setStatus('Connected · live sync active on all paired devices');
      else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') setStatus('Reconnecting live sync…');
    });
}
async function initialSync() {
  if (!supabase || !user || !workspace) throw new Error('Pair this device with the shared Prime Auto Care business first.');
  stockLedgerSchemaReady = false;
  await refreshStockLedgerSchemaStatus();
  setStatus('Loading shared Prime Auto Care data…');
  const { data, error } = await supabase.from('washdesk_sync')
    .select('payload,updated_at')
    .eq('user_id', workspace.owner_user_id)
    .maybeSingle();
  if (error) throw error;
  if (data?.payload) {
    lastRemoteUpdatedAt = String(data.updated_at || '');
    if (Number(data.payload?.meta?.serverStockLedgerVersion) !== 1) {
      stockLedgerSchemaReady = false;
      schemaBlocked = true;
      setStatus('Cloud SQL update required · the workspace has not completed its stock-ledger handshake.');
      throw new Error('CLOUD_SCHEMA_UPDATE_REQUIRED');
    }
    const merged = applyRemote(data.payload);
    if (merged && stableStringify(merged) !== stableStringify(data.payload)) {
      await publishPayload(merged);
    } else if (merged) {
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
  // Realtime sends full snapshots only after actual changes. The safety net
  // checks updated_at every two minutes and downloads payload only on change.
  const reconcile = async () => {
    if (!navigator.onLine || !user || !workspace || !supabase || syncing || document.visibilityState === 'hidden') return;
    try {
      const { data: marker, error: markerError } = await supabase.from('washdesk_sync')
        .select('updated_at')
        .eq('user_id', workspace.owner_user_id)
        .maybeSingle();
      if (markerError || !marker?.updated_at || !remoteHandler) return;
      const serverUpdatedAt = String(marker.updated_at);
      if (serverUpdatedAt === lastRemoteUpdatedAt) return;
      const { data, error } = await supabase.from('washdesk_sync')
        .select('payload,updated_at')
        .eq('user_id', workspace.owner_user_id)
        .maybeSingle();
      if (error || !data?.payload) return;
      lastRemoteUpdatedAt = String(data.updated_at || serverUpdatedAt);
      const incomingText = stableStringify(data.payload);
      if (incomingText === lastPayloadString) return;
      const merged = applyRemote(data.payload);
      if (!merged) return;
      if (stableStringify(merged) !== incomingText) await publishPayload(merged);
      else {
        lastPayloadString = incomingText;
        setStatus('Connected · live sync active on all paired devices');
      }
    } catch (error) {
      console.warn('Prime Auto Care sync reconciliation:', error);
    }
  };
  pollingTimer = setInterval(reconcile, 120000);
  if (visibilityReconcileListener) document.removeEventListener('visibilitychange', visibilityReconcileListener);
  visibilityReconcileListener = () => { if (document.visibilityState === 'visible') void reconcile(); };
  document.addEventListener('visibilitychange', visibilityReconcileListener);
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
    if (workspace?.role === 'owner') {
      await initialSync();
    } else {
      clearTimeout(pushTimer);
      clearInterval(pollingTimer);
      if (channel && supabase) await supabase.removeChannel(channel);
      channel = null;
      queuedPayload = null;
      stockLedgerSchemaReady = false;
      schemaBlocked = false;
      lastPayloadString = '';
      lastRemoteUpdatedAt = '';
      setStatus('Connected as booking staff · Bookings only · Accept / Reject enabled');
    }
    return true;
  } catch (error) {
    console.error('Prime Auto Care cloud resume failed:', error);
    const message = String(error?.message || error || '');
    if (workspace && !navigator.onLine) {
      setStatus('Offline · shared workspace saved; automatic sync will resume when internet returns');
    } else if (message.includes('CLOUD_SCHEMA_UPDATE_REQUIRED')) {
      setStatus('Cloud SQL update required · run the latest Cloud Sync SQL file once in Supabase, then tap Sync now.');
    } else if (message.includes('APP_UPDATE_REQUIRED')) {
      setStatus('App update required · update every paired phone and computer to Prime Auto Care 2.5.2 or later.');
    } else {
      setStatus(message.includes('washdesk_sync') ? 'Signed in · run the shared database SQL setup' : 'Cloud reconnect needed · retry when internet returns');
    }
    return false;
  }
}
async function syncNow(payload) {
  if (!supabase || !user || !workspace) throw new Error('Connect this device with the PAC Owner Code first.');
  if (workspace.role !== 'owner') throw new Error('Staff devices have booking-only access. Business sync is Owner-only.');
  await refreshStockLedgerSchemaStatus();
  schemaBlocked = false;
  queuedPayload = null;
  return await publishPayload(payload);
}
async function nextInvoiceNumber({ prefix, date, minNext }) {
  if (!supabase || !user || !workspace) throw new Error('Shared cloud database is not connected.');
  if (workspace.role !== 'owner') throw new Error('Staff devices cannot create invoices.');
  if (!stockLedgerSchemaReady) throw new Error('Run the latest Prime Auto Care Cloud Sync SQL update before reserving shared invoice numbers.');
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
  lastRemoteUpdatedAt = '';
  queuedPayload = null;
  schemaBlocked = false;
  stockLedgerSchemaReady = false;
  localStorage.removeItem(WORKSPACE_KEY);
  setStatus('This device disconnected · local records remain safe');
}
async function getApiContext() {
  if (!supabase) initialize(readConfig());
  if (!user) await ensureSession();
  if (!workspace) workspace = await getWorkspaceFromServer();
  if (!workspace) throw new Error('Pair this device with the Prime Auto Care shared workspace first.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data?.session?.access_token) throw new Error('The shared cloud session expired. Reconnect this device.');
  const config = readConfig();
  return {
    url: config.url,
    anonKey: config.anonKey,
    accessToken: data.session.access_token,
    workspace
  };
}
window.WashDeskCloud = {
  getApiContext,
  signInOwner,
  requestOwnerPasswordRecovery,
  completeOwnerPasswordRecovery,
  pairDevice,
  pairBookingDevice,
  resume,
  schedulePush,
  syncNow,
  nextInvoiceNumber,
  disconnect,
  getStatus: () => statusText,
  getConfig: () => readConfig(),
  getWorkspace: () => workspace || readWorkspace(),
  isStockLedgerReady: () => stockLedgerSchemaReady
};
window.addEventListener('online', () => {
  retryDelay = 1500;
  if (user && workspace && localProvider && workspace.role === 'owner') {
    // Pull and merge the canonical snapshot first; never push a stale offline
    // snapshot before another Owner's newer records have been fetched.
    void initialSync().catch(error => console.warn('Prime Auto Care cloud reconnect:', error));
  } else if (user && workspace && workspace.role === 'member') {
    setStatus('Connected as booking staff · Bookings only · business sync is Owner-only');
  } else if (localProvider && remoteHandler) {
    void resume({ getLocal: localProvider, onRemote: remoteHandler }).catch(error => console.warn('Prime Auto Care saved device reconnect:', error));
  }
});

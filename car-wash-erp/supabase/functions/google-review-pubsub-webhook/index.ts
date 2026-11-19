import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
function env(name: string) { return Deno.env.get(name)?.trim() || ''; }
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function secretServiceKey() {
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try {
    const parsed = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}');
    return parsed.default || Object.values(parsed)[0] || '';
  } catch { return ''; }
}
function serviceClient() {
  const url = env('SUPABASE_URL'), key = secretServiceKey();
  if (!url || !key) throw new Error('Supabase server credentials are not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function verifyPushIdentity(req: Request, service: any) {
  const auth = req.headers.get('Authorization') || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('Google Pub/Sub OIDC token is missing.');
  const token = match[1];
  if (token.length > 12000) throw new Error('Google Pub/Sub OIDC token is too large.');
  const response = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token));
  const claims = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Google Pub/Sub identity token could not be verified.');
  const audience = String(claims.aud || '');
  const email = String(claims.email || '').toLowerCase();
  const verified = claims.email_verified === true || String(claims.email_verified).toLowerCase() === 'true';
  const expires = Number(claims.exp || 0);
  if (!audience || !email || !verified || expires <= Math.floor(Date.now() / 1000)) {
    throw new Error('Google Pub/Sub identity token is invalid, unverified or expired.');
  }
  const { data, error } = await service.from('pac_google_review_settings')
    .select('workspace_id')
    .eq('google_pubsub_audience', audience)
    .eq('pubsub_push_service_account', email)
    .maybeSingle();
  if (error || !data?.workspace_id) throw new Error('Google Pub/Sub identity does not match the configured Prime Auto Care subscription.');
  return String(data.workspace_id);
}
function decodePubSubData(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
function notificationFields(value: any) {
  const nested = value?.notification || value?.event || value || {};
  return {
    notificationType: String(nested.notificationType || nested.notification_type || nested.type || ''),
    locationName: String(nested.locationName || nested.location_name || nested.location || ''),
    reviewName: String(nested.reviewName || nested.review_name || nested.review || ''),
    publishTime: String(nested.publishTime || nested.publish_time || '')
  };
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required.' }, 405);
  try {
    const service = await serviceClient();
    const verifiedWorkspaceId = await verifyPushIdentity(req, service);
    const envelope = await req.json().catch(() => null);
    const message = envelope?.message;
    if (!message?.data || !message?.messageId) throw new Error('Pub/Sub push envelope is incomplete.');
    const event = notificationFields(decodePubSubData(String(message.data)));
    if (!['NEW_REVIEW', 'UPDATED_REVIEW'].includes(event.notificationType)) {
      return json({ accepted: true, ignored: true, reason: 'Notification type is not a review event.' });
    }
    if (!event.locationName.startsWith('accounts/') || !event.locationName.includes('/locations/')) {
      throw new Error('Google review notification did not contain a valid location resource.');
    }
    const accountName = event.locationName.split('/locations/')[0];
    const { data: settings, error: settingsError } = await service.from('pac_google_review_settings')
      .select('workspace_id,notifications_enabled').eq('workspace_id', verifiedWorkspaceId)
      .eq('google_account_resource_name', accountName).eq('notifications_enabled', true).maybeSingle();
    if (settingsError) throw settingsError;
    if (!settings?.workspace_id) {
      return json({ accepted: true, ignored: true, reason: 'No enabled Prime Auto Care notification setting matched this Google account.' });
    }
    const workspaceId = settings.workspace_id;
    const messageId = String(message.messageId);
    const { data: existing, error: existingError } = await service.from('pac_google_review_events')
      .select('id,processed_at').eq('workspace_id', workspaceId).eq('pubsub_message_id', messageId).maybeSingle();
    if (existingError) throw existingError;
    let eventId = existing?.id;
    if (!existing) {
      const { data: inserted, error: insertError } = await service.from('pac_google_review_events').insert({
        workspace_id: workspaceId,
        pubsub_message_id: messageId,
        notification_type: event.notificationType,
        location_name: event.locationName,
        review_name: event.reviewName || null,
        publish_time: event.publishTime && !Number.isNaN(Date.parse(event.publishTime)) ? new Date(event.publishTime).toISOString() : null,
        payload: event
      }).select('id').single();
      if (insertError) throw insertError;
      eventId = inserted.id;
    } else if (existing.processed_at) {
      return json({ accepted: true, duplicate: true, processed: true });
    }
    const url = env('SUPABASE_URL');
    const { data: workerSecret, error: workerSecretError } = await service.rpc('pac_get_google_review_worker_secret', { p_workspace_id: workspaceId });
    if (workerSecretError || !workerSecret) throw new Error('The internal Google review worker token is missing from Supabase Vault. Re-save Pub/Sub setup in WashDesk.');
    const workerResponse = await fetch(url.replace(/\/$/, '') + '/functions/v1/google-review-worker', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-google-review-worker-secret': workerSecret },
      body: JSON.stringify({ source: 'pubsub', event_id: eventId })
    });
    const workerBody = await workerResponse.json().catch(() => ({}));
    if (!workerResponse.ok) throw new Error('The review refresh worker failed after a Pub/Sub notification.');
    const now = new Date().toISOString();
    await service.from('pac_google_review_events').update({ processed_at: now }).eq('id', eventId);
    await service.from('pac_google_review_settings').update({
      notifications_last_event_at: now, notifications_last_error: null, updated_at: now
    }).eq('workspace_id', workspaceId);
    return json({ accepted: true, refreshed: true, notification_type: event.notificationType, sync: workerBody });
  } catch (error) {
    console.error('Google Pub/Sub review webhook failed:', error instanceof Error ? error.message : 'unknown');
    return json({ error: error instanceof Error ? error.message : 'Pub/Sub notification failed.' }, 401);
  }
});

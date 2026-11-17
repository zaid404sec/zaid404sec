import { createClient } from 'npm:@supabase/supabase-js@2';

function env(name: string) { return Deno.env.get(name)?.trim() || ''; }
function base64Url(bytes: Uint8Array) {
  let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromBase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')), c => c.charCodeAt(0));
}
async function encryptText(value: string) {
  const encoded = env('GOOGLE_TOKEN_ENCRYPTION_KEY');
  if (!encoded) throw new Error('Google token encryption is not configured.');
  const raw = fromBase64(encoded);
  if (raw.length !== 32) throw new Error('Google token encryption key must be 32 bytes.');
  const key = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array([...iv, ...new Uint8Array(encrypted)]));
}
async function decryptText(value: string) {
  const encoded = env('GOOGLE_TOKEN_ENCRYPTION_KEY');
  if (!encoded) throw new Error('Google token encryption is not configured.');
  const rawKey = fromBase64(encoded), raw = fromBase64(value);
  if (rawKey.length !== 32 || raw.length < 29) throw new Error('Google encrypted credential is invalid.');
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12));
  return new TextDecoder().decode(plain);
}
async function serviceClient() {
  const url = env('SUPABASE_URL');
  let key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!key) { try { const values = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}'); key = values.default || Object.values(values)[0] || ''; } catch { } }
  if (!url || !key) throw new Error('Supabase server credentials are not configured.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
function html(message: string, failed = false) {
  const safe = message.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] as string));
  return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prime Auto Care · Google Reviews</title><body style="margin:0;background:#101114;color:#f7f5f0;font:16px Arial;display:grid;min-height:100vh;place-items:center"><main style="max-width:520px;padding:32px;text-align:center"><h1 style="color:#e2c27c">Prime Auto Care</h1><p>${safe}</p><p style="color:#aaa">Return to WashDesk and open Google Review Center to continue.</p></main></body></html>`, {
    status: failed ? 400 : 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}
Deno.serve(async req => {
  if (req.method !== 'GET') return new Response('GET required.', { status: 405 });
  try {
    const url = new URL(req.url);
    const providerError = url.searchParams.get('error');
    if (providerError) return html('Google did not complete authorization: ' + providerError + '.', true);
    const code = url.searchParams.get('code') || '';
    const state = url.searchParams.get('state') || '';
    if (!code || !state || state.length > 300) return html('The Google authorization response is incomplete. Start Connect Google again from WashDesk.', true);
    const service = await serviceClient();
    const digest = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(state))));
    const { data: oauthState, error: stateError } = await service.from('pac_google_oauth_states')
      .select('state_hash,workspace_id,initiated_by,encrypted_code_verifier,expires_at,consumed_at')
      .eq('state_hash', digest).maybeSingle();
    if (stateError || !oauthState || oauthState.consumed_at || Date.parse(oauthState.expires_at) < Date.now()) {
      return html('The one-time Google authorization state is invalid or expired. Start Connect Google again.', true);
    }
    const verifier = await decryptText(oauthState.encrypted_code_verifier);
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env('GOOGLE_OAUTH_CLIENT_ID'),
        client_secret: env('GOOGLE_OAUTH_CLIENT_SECRET'),
        redirect_uri: env('GOOGLE_OAUTH_REDIRECT_URI'),
        grant_type: 'authorization_code', code, code_verifier: verifier
      })
    });
    const token = await response.json().catch(() => ({}));
    if (!response.ok || !token.access_token) {
      console.error('Google OAuth token exchange failed:', token.error || response.status);
      return html('Google could not complete account authorization. Check your OAuth client, redirect URL and Basic API Access status.', true);
    }
    const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: 'Bearer ' + token.access_token }
    });
    const userInfo = await userResponse.json().catch(() => ({}));
    if (!userResponse.ok || !userInfo.email || userInfo.email_verified !== true) {
      return html('Google did not return a verified account email. Cancel this connection and try again.', true);
    }
    const { data: settings } = await service.from('pac_google_review_settings')
      .select('google_account_email').eq('workspace_id', oauthState.workspace_id).maybeSingle();
    const expectedEmail = String(settings?.google_account_email || '').toLowerCase();
    if (expectedEmail && expectedEmail !== String(userInfo.email).toLowerCase()) {
      return html('You authorised ' + userInfo.email + ', but WashDesk is configured for ' + expectedEmail + '. Reconnect using the configured Primary Owner account.', true);
    }
    const { data: existing } = await service.from('pac_google_oauth_credentials')
      .select('encrypted_refresh_token').eq('workspace_id', oauthState.workspace_id).maybeSingle();
    const refreshToken = token.refresh_token
      ? await encryptText(String(token.refresh_token))
      : existing?.encrypted_refresh_token;
    if (!refreshToken) return html('Google did not issue an offline refresh token. Revoke this app in Google Account security and connect again, selecting the consent prompt.', true);
    const now = new Date().toISOString();
    const grantedScopes = String(token.scope || '').split(/\s+/).filter(Boolean);
    if (!grantedScopes.includes('https://www.googleapis.com/auth/business.manage')) {
      return html('Google did not grant the Business Profile management permission required by WashDesk.', true);
    }
    const { error: saveError } = await service.from('pac_google_oauth_credentials').upsert({
      workspace_id: oauthState.workspace_id,
      google_user_email: String(userInfo.email),
      encrypted_access_token: await encryptText(String(token.access_token)),
      encrypted_refresh_token: refreshToken,
      access_token_expires_at: new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString(),
      granted_scopes: grantedScopes, token_type: String(token.token_type || 'Bearer'),
      updated_at: now
    }, { onConflict: 'workspace_id' });
    if (saveError) throw saveError;
    await service.from('pac_google_review_settings').upsert({
      workspace_id: oauthState.workspace_id,
      google_account_email: String(userInfo.email),
      api_status: 'access_pending',
      last_sync_error: null,
      updated_at: now
    }, { onConflict: 'workspace_id' });
    await service.from('pac_google_oauth_states').update({ consumed_at: now }).eq('state_hash', digest);
    return html('Google account ' + userInfo.email + ' was authorised securely. Return to WashDesk and run Sync Reviews. The API still needs Google Basic API Access approval before reviews can be fetched.');
  } catch (error) {
    console.error('Prime Auto Care Google OAuth callback failed:', error instanceof Error ? error.message : 'unknown');
    return html('Google authorization could not be saved securely. Return to WashDesk and try again, or check the server configuration.', true);
  }
});

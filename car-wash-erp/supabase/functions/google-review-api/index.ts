import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
type Context = { service: any; workspace: any; member: any; user: any };
function env(name: string) { return Deno.env.get(name)?.trim() || ''; }
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function base64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromBase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')), c => c.charCodeAt(0));
}
function encryptionKey() {
  const encoded = env('GOOGLE_TOKEN_ENCRYPTION_KEY');
  if (!encoded) throw new Error('Google review encryption is not configured on the server.');
  const raw = fromBase64(encoded);
  if (raw.length !== 32) throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
async function encryptText(value: string) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
  return base64Url(new Uint8Array([...iv, ...new Uint8Array(encrypted)]));
}
async function decryptText(value: string) {
  const raw = fromBase64(value);
  if (raw.length < 29) throw new Error('Encrypted Google credential is invalid.');
  const key = await encryptionKey();
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12));
  return new TextDecoder().decode(plain);
}
function randomToken(bytes = 32) { return base64Url(crypto.getRandomValues(new Uint8Array(bytes))); }
async function sha256(value: string) {
  return base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}
function secretServiceKey() {
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try {
    const parsed = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}');
    return parsed.default || Object.values(parsed)[0] || '';
  } catch { return ''; }
}
function secretPublishableKey() {
  const legacy = env('SUPABASE_ANON_KEY');
  if (legacy) return legacy;
  try {
    const parsed = JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    return parsed.default || Object.values(parsed)[0] || '';
  } catch { return ''; }
}
async function authenticate(req: Request): Promise<Context> {
  const url = env('SUPABASE_URL'), anon = secretPublishableKey(), serviceKey = secretServiceKey();
  if (!url || !anon || !serviceKey) throw new Error('Supabase server environment is incomplete.');
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Sign in to the paired Prime Auto Care workspace first.');
  const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: auth, error: authError } = await authClient.auth.getUser(token);
  if (authError || !auth?.user) throw new Error('The device session expired. Reconnect cloud sync and retry.');
  const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: member, error: memberError } = await service.from('washdesk_workspace_members')
    .select('workspace_id,role').eq('auth_user_id', auth.user.id).maybeSingle();
  if (memberError || !member) throw new Error('This device is not paired with the Prime Auto Care workspace.');
  const { data: workspace, error: workspaceError } = await service.from('washdesk_workspaces')
    .select('id,owner_auth_user_id,business_name').eq('id', member.workspace_id).single();
  if (workspaceError || !workspace?.owner_auth_user_id) throw new Error('The Prime Auto Care workspace owner could not be found.');
  return { service, workspace, member, user: auth.user };
}
function requireOwner(ctx: Context) {
  if (ctx.member.role !== 'owner' || ctx.workspace.owner_auth_user_id !== ctx.user.id) {
    throw new Error('Only the Prime Auto Care workspace owner can connect Google or publish a business reply.');
  }
}
async function getSettings(ctx: Context) {
  const { data, error } = await ctx.service.from('pac_google_review_settings')
    .select('*').eq('workspace_id', ctx.workspace.id).maybeSingle();
  if (error) throw error;
  return data || {};
}
async function googleCredentials(ctx: Context) {
  const { data, error } = await ctx.service.from('pac_google_oauth_credentials')
    .select('*').eq('workspace_id', ctx.workspace.id).maybeSingle();
  if (error || !data?.encrypted_refresh_token) throw new Error('Google is not connected. Complete owner OAuth after Business Profile API access is approved.');
  return data;
}
async function googleAccessToken(ctx: Context) {
  const credentials = await googleCredentials(ctx);
  const expires = credentials.access_token_expires_at ? Date.parse(credentials.access_token_expires_at) : 0;
  if (credentials.encrypted_access_token && expires > Date.now() + 90_000) return decryptText(credentials.encrypted_access_token);
  const refreshToken = await decryptText(credentials.encrypted_refresh_token);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_OAUTH_CLIENT_ID'),
      client_secret: env('GOOGLE_OAUTH_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  const token = await response.json().catch(() => ({}));
  if (!response.ok || !token.access_token) throw new Error('Google authorization expired or could not be refreshed. Reconnect the owner account.');
  const encryptedAccess = await encryptText(String(token.access_token));
  await ctx.service.from('pac_google_oauth_credentials').update({
    encrypted_access_token: encryptedAccess,
    access_token_expires_at: new Date(Date.now() + Number(token.expires_in || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString()
  }).eq('workspace_id', ctx.workspace.id);
  return String(token.access_token);
}
async function googleFetch(url: string, token: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: 'Bearer ' + token, ...(init.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(body?.error?.message || body?.error_description || '');
    if (response.status === 403) throw new Error('Google denied the Business Profile API request. Confirm Basic API Access is approved and the owner account has access. ' + message);
    if (response.status === 401) throw new Error('Google authorization expired. Reconnect the owner account.');
    throw new Error('Google Business Profile API error (' + response.status + '): ' + (message || 'Request failed.'));
  }
  return body;
}
function ratingNumber(value: unknown) {
  const text = String(value || '').toUpperCase();
  const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[text] || Number(value) || null;
}
function normalizedTitle(value: unknown) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
async function resolveGoogleLocation(ctx: Context, token: string, settings: any) {
  if (settings.google_account_resource_name && settings.google_location_resource_name) {
    return { accountName: settings.google_account_resource_name, locationName: settings.google_location_resource_name };
  }
  const accountsData = await googleFetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', token);
  const accounts = Array.isArray(accountsData.accounts) ? accountsData.accounts : [];
  if (!accounts.length) throw new Error('No Google Business Profile accounts were returned for the connected owner.');
  const targetId = String(settings.google_business_profile_id || '13506481990772076097').trim();
  const matches: Array<{ accountName: string; locationName: string; title: string }> = [];
  for (const account of accounts) {
    let pageToken = '';
    for (let page = 0; page < 5; page++) {
      const query = new URLSearchParams({ readMask: 'name,title,storefrontAddress,websiteUri,metadata', pageSize: '100' });
      if (pageToken) query.set('pageToken', pageToken);
      const endpoint = 'https://mybusinessbusinessinformation.googleapis.com/v1/' + account.name + '/locations?' + query.toString();
      const data = await googleFetch(endpoint, token);
      for (const location of data.locations || []) {
        const resourceId = String(location.name || '').split('/').pop() || '';
        const nameMatch = normalizedTitle(location.title) === 'prime auto care';
        if ((targetId && resourceId === targetId) || nameMatch) {
          matches.push({ accountName: String(account.name), locationName: String(location.name), title: String(location.title || '') });
        }
      }
      pageToken = String(data.nextPageToken || '');
      if (!pageToken) break;
    }
  }
  const unique = [...new Map(matches.map(item => [item.locationName, item])).values()];
  if (!unique.length) throw new Error('Could not match the supplied Profile ID to a Google API location. The Profile ID may differ from the API Location ID. Confirm the Business Profile is under the connected owner account and retry.');
  if (unique.length > 1) throw new Error('Google returned more than one matching Prime Auto Care location. The API location must be selected before sync; no location was guessed.');
  const result = unique[0];
  await ctx.service.from('pac_google_review_settings').upsert({
    workspace_id: ctx.workspace.id,
    google_account_resource_name: result.accountName,
    google_location_resource_name: result.locationName,
    updated_at: new Date().toISOString()
  }, { onConflict: 'workspace_id' });
  return result;
}
async function syncReviews(ctx: Context) {
  const settings = await getSettings(ctx);
  const token = await googleAccessToken(ctx);
  const location = await resolveGoogleLocation(ctx, token, settings);
  const locationId = location.locationName.split('/').pop();
  let pageToken = '';
  let fetched = 0, inserted = 0, updated = 0;
  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({ pageSize: '50', orderBy: 'updateTime desc' });
    if (pageToken) query.set('pageToken', pageToken);
    const url = 'https://mybusiness.googleapis.com/v4/' + location.accountName + '/locations/' + locationId + '/reviews?' + query.toString();
    const data = await googleFetch(url, token);
    const reviews = Array.isArray(data.reviews) ? data.reviews : [];
    fetched += reviews.length;
    for (const item of reviews) {
      const resource = String(item.name || item.reviewId || '');
      if (!resource) continue;
      const row = {
        workspace_id: ctx.workspace.id,
        google_review_id: resource,
        reviewer_name: item.reviewer?.displayName || null,
        reviewer_profile_url: item.reviewer?.profilePhotoUrl || null,
        star_rating: ratingNumber(item.starRating),
        comment: item.comment || '',
        google_created_at: item.createTime || null,
        google_updated_at: item.updateTime || null,
        reply_comment: item.reviewReply?.comment || null,
        reply_updated_at: item.reviewReply?.updateTime || null,
        is_removed: false,
        raw_payload: item,
        last_fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      const { data: prior } = await ctx.service.from('pac_google_reviews').select('id')
        .eq('workspace_id', ctx.workspace.id).eq('google_review_id', resource).maybeSingle();
      const { error } = await ctx.service.from('pac_google_reviews').upsert(row, { onConflict: 'workspace_id,google_review_id' });
      if (error) throw error;
      if (prior?.id) updated++; else inserted++;
    }
    pageToken = String(data.nextPageToken || '');
    if (!pageToken) break;
  }
  const now = new Date().toISOString();
  await ctx.service.from('pac_google_review_settings').upsert({
    workspace_id: ctx.workspace.id,
    google_account_resource_name: location.accountName,
    google_location_resource_name: location.locationName,
    api_status: 'connected',
    last_successful_sync_at: now,
    last_sync_error: null,
    updated_at: now
  }, { onConflict: 'workspace_id' });
  await ctx.service.from('pac_google_review_sync_logs').insert({
    workspace_id: ctx.workspace.id, sync_source: 'manual', status: 'success',
    fetched_count: fetched, inserted_count: inserted, updated_count: updated, completed_at: now
  });
  return { fetched, inserted, updated, location: location.title || location.locationName, synced_at: now };
}
async function getReviewRecords(ctx: Context, limit = 200) {
  const { data, error } = await ctx.service.from('pac_google_reviews').select(
    'id,google_review_id,reviewer_name,star_rating,comment,google_created_at,google_updated_at,reply_comment,reply_updated_at'
  ).eq('workspace_id', ctx.workspace.id).eq('is_removed', false)
    .order('google_created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data || [];
}
async function gemini(prompt: string, jsonMode = false) {
  const key = env('GEMINI_API_KEY');
  if (!key) throw new Error('Gemini AI is not configured yet. Add GEMINI_API_KEY as a Supabase Edge Function secret; never put it in the APK.');
  const model = env('GEMINI_MODEL') || 'gemini-4-hydrogen';
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.25, ...(jsonMode ? { responseMimeType: 'application/json' } : {}) }
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Gemini request failed (' + response.status + '): ' + String(body?.error?.message || 'Provider unavailable.'));
  const text = body.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('\n').trim();
  if (!text) throw new Error('Gemini returned an empty response. Try again.');
  return { text, model };
}
function parseJson(text: string) {
  const cleaned = text.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/i, '').trim();
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI returned an invalid structured response. Retry the analysis.');
  return JSON.parse(cleaned.slice(start, end + 1));
}
async function ownerSettings(ctx: Context, settings: any) {
  requireOwner(ctx);
  const safe = {
    workspace_id: ctx.workspace.id,
    google_account_email: String(settings?.google_account_email || '').trim().toLowerCase() || null,
    google_business_profile_id: String(settings?.google_business_profile_id || '').trim() || null,
    google_business_profile_url: String(settings?.google_business_profile_url || '').trim() || null,
    website_url: String(settings?.website_url || '').trim() || null,
    review_link: String(settings?.review_link || '').trim() || null,
    updated_at: new Date().toISOString()
  };
  for (const key of ['google_business_profile_url', 'website_url', 'review_link'] as const) {
    const value = safe[key];
    if (value && !/^https:\/\//i.test(value)) throw new Error('Google Profile, website and review links must use HTTPS.');
  }
  if (safe.google_account_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safe.google_account_email)) throw new Error('Enter a valid Google account email.');
  const { error } = await ctx.service.from('pac_google_review_settings').upsert(safe, { onConflict: 'workspace_id' });
  if (error) throw error;
  return { saved: true };
}
async function startOAuth(ctx: Context) {
  requireOwner(ctx);
  const clientId = env('GOOGLE_OAUTH_CLIENT_ID'), redirectUri = env('GOOGLE_OAUTH_REDIRECT_URI');
  if (!clientId || !env('GOOGLE_OAUTH_CLIENT_SECRET') || !redirectUri || !env('GOOGLE_TOKEN_ENCRYPTION_KEY')) {
    throw new Error('Google OAuth is not configured on the server. Basic API access and Google Cloud OAuth credentials must be prepared first.');
  }
  const state = randomToken(32), verifier = randomToken(48);
  const challenge = await sha256(verifier);
  const now = new Date();
  const { error } = await ctx.service.from('pac_google_oauth_states').insert({
    state_hash: await sha256(state), workspace_id: ctx.workspace.id,
    initiated_by: ctx.user.id, encrypted_code_verifier: await encryptText(verifier),
    created_at: now.toISOString(), expires_at: new Date(now.getTime() + 10 * 60 * 1000).toISOString()
  });
  if (error) throw error;
  const query = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code',
    scope: 'openid email https://www.googleapis.com/auth/business.manage',
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
    state, code_challenge: challenge, code_challenge_method: 'S256'
  });
  return { auth_url: 'https://accounts.google.com/o/oauth2/v2/auth?' + query.toString() };
}
async function status(ctx: Context) {
  const settings = await getSettings(ctx);
  const [reviews, invitations, credentials] = await Promise.all([
    ctx.service.from('pac_google_reviews').select('id,star_rating,reply_comment,google_created_at').eq('workspace_id', ctx.workspace.id).eq('is_removed', false),
    ctx.service.from('pac_review_invitation_logs').select('channel,status,prepared_at,sent_confirmed_at').eq('workspace_id', ctx.workspace.id),
    ctx.service.from('pac_google_oauth_credentials').select('workspace_id,google_user_email,access_token_expires_at').eq('workspace_id', ctx.workspace.id).maybeSingle()
  ]);
  if (reviews.error || invitations.error || credentials.error) throw reviews.error || invitations.error || credentials.error;
  const rows = reviews.data || [], logs = invitations.data || [];
  const ratings = rows.map((r: any) => Number(r.star_rating)).filter((x: number) => x >= 1 && x <= 5);
  const distribution: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  ratings.forEach((rating: number) => distribution[String(rating)]++);
  const sent = logs.filter((row: any) => row.status === 'sent_confirmed');
  const prepared = logs;
  return {
    settings: { google_account_email: settings.google_account_email || null, google_business_profile_id: settings.google_business_profile_id || '13506481990772076097', google_business_profile_url: settings.google_business_profile_url || 'https://share.google/6g3f0aJqTezi6JH5T', website_url: settings.website_url || null, review_link: settings.review_link || null },
    connection: {
      status: settings.api_status || 'access_pending',
      oauth_connected: !!credentials.data?.workspace_id,
      google_user_email: credentials.data?.google_user_email || null,
      last_sync_at: settings.last_successful_sync_at || null,
      last_error: settings.last_sync_error || null
    },
    metrics: {
      total_reviews: rows.length,
      average_rating: ratings.length ? Number((ratings.reduce((a: number,b: number)=>a+b,0)/ratings.length).toFixed(2)) : null,
      unanswered: rows.filter((r: any) => !r.reply_comment).length,
      distribution,
      invitations_prepared: prepared.length,
      invitations_sent_confirmed: sent.length,
      invitations_total: logs.length
    }
  };
}
async function handle(ctx: Context, body: any) {
  const action = String(body.action || '');
  if (action === 'status') return status(ctx);
  if (action === 'save-settings') return ownerSettings(ctx, body.settings || {});
  if (action === 'connect') return startOAuth(ctx);
  if (action === 'sync') return syncReviews(ctx);
  if (action === 'reviews') return { reviews: await getReviewRecords(ctx) };
  if (action === 'log-invitation') {
    const channel = String(body.channel || '');
    const status = String(body.status || 'prepared');
    if (!['invoice_pdf', 'whatsapp', 'counter_qr'].includes(channel)) throw new Error('Invitation channel is invalid.');
    if (!['prepared', 'sent_confirmed'].includes(status)) throw new Error('Invitation status is invalid.');
    if (status === 'sent_confirmed') {
      const { data: pending } = await ctx.service.from('pac_review_invitation_logs').select('id')
        .eq('workspace_id', ctx.workspace.id).eq('channel', channel).eq('status', 'prepared')
        .order('prepared_at', { ascending: false }).limit(1).maybeSingle();
      if (pending?.id) {
        const { error } = await ctx.service.from('pac_review_invitation_logs').update({
          status: 'sent_confirmed', sent_confirmed_by: ctx.user.id,
          sent_confirmed_at: new Date().toISOString()
        }).eq('id', pending.id);
        if (error) throw error;
      } else {
        const { error } = await ctx.service.from('pac_review_invitation_logs').insert({
          workspace_id: ctx.workspace.id, invoice_id: String(body.invoice_id || '') || null,
          invoice_number: String(body.invoice_number || '') || null, channel, status,
          prepared_by: ctx.user.id, sent_confirmed_by: ctx.user.id,
          sent_confirmed_at: new Date().toISOString(),
          idempotency_key: String(body.idempotency_key || '') || null
        });
        if (error) throw error;
      }
    } else {
      const { error } = await ctx.service.from('pac_review_invitation_logs').insert({
        workspace_id: ctx.workspace.id, invoice_id: String(body.invoice_id || '') || null,
        invoice_number: String(body.invoice_number || '') || null, channel, status,
        prepared_by: ctx.user.id,
        idempotency_key: String(body.idempotency_key || '') || null
      });
      if (error) throw error;
    }
    return { logged: true, status };
  }
  if (action === 'level1-chat') {
    const question = String(body.question || '').trim();
    if (!question || question.length > 1200) throw new Error('Enter a question of up to 1,200 characters.');
    const reviews = await getReviewRecords(ctx, 100);
    if (!reviews.length) return { answer: 'There are no Google reviews synced yet. Connect the owner account after Google approves Business Profile API access, then sync reviews before asking review-data questions.', evidence: [] };
    const evidence = reviews.map((r: any) => ({ id: r.id, rating: r.star_rating, date: r.google_created_at, comment: String(r.comment||'').slice(0,800), reply: String(r.reply_comment||'').slice(0,500) }));
    const result = await gemini('You are the Prime Auto Care review-data assistant. Answer only from the supplied Google review records. Do not invent customer comments, dates, ratings, service facts or trends. If the records do not support a conclusion, say so. Cite supporting record IDs. Keep the answer concise.\nQUESTION:\n' + question + '\nREVIEW RECORDS:\n' + JSON.stringify(evidence));
    return { answer: result.text, evidence: evidence.map((r: any) => ({ id: r.id, rating: r.rating, date: r.date })) };
  }
  if (action === 'level2-analyze') {
    const reviewId = String(body.review_id || '');
    if (!reviewId) throw new Error('Select a synced review first.');
    const { data: review, error } = await ctx.service.from('pac_google_reviews').select('*')
      .eq('workspace_id', ctx.workspace.id).eq('id', reviewId).single();
    if (error || !review) throw new Error('The selected Google review could not be found.');
    const result = await gemini('You are Prime Auto Care\'s review-management agent. Analyse this genuine customer review. Never invent facts, promise refunds or compensation, argue with the reviewer, or ask the customer to change a rating. Create a polite owner reply draft which acknowledges only facts actually present in the review. Return JSON only with keys sentiment (positive|neutral|negative|mixed), topics (array of short strings), complaintFlag (boolean), priority (low|normal|high|urgent), summary (string), recommendations (array of strings), replyDraft (string).\nREVIEW:\n' + JSON.stringify({ rating: review.star_rating, comment: review.comment, created: review.google_created_at }));
    const generated = parseJson(result.text);
    const allowedSentiments = ['positive','neutral','negative','mixed'];
    const allowedPriorities = ['low','normal','high','urgent'];
    const parsed = {
      sentiment: allowedSentiments.includes(String(generated.sentiment)) ? String(generated.sentiment) : 'mixed',
      topics: Array.isArray(generated.topics) ? generated.topics.filter((x:any)=>typeof x==='string').slice(0,8) : [],
      complaintFlag: generated.complaintFlag === true,
      priority: allowedPriorities.includes(String(generated.priority)) ? String(generated.priority) : 'normal',
      summary: String(generated.summary || '').slice(0,1200),
      recommendations: Array.isArray(generated.recommendations) ? generated.recommendations.filter((x:any)=>typeof x==='string').slice(0,8) : [],
      replyDraft: String(generated.replyDraft || '').trim().slice(0,4000)
    };
    if (!parsed.replyDraft) throw new Error('Gemini did not create a usable reply draft. Retry this review.');
    const { data: analysis, error: analysisError } = await ctx.service.from('pac_review_ai_analysis').upsert({
      workspace_id: ctx.workspace.id, review_row_id: review.id, analysis_level: 2,
      sentiment: parsed.sentiment, topics: parsed.topics, complaint_flag: parsed.complaintFlag,
      priority: parsed.priority, summary: parsed.summary, recommendations: parsed.recommendations,
      model_provider: 'google', model_name: result.model, analysis_payload: parsed
    }, { onConflict: 'review_row_id,analysis_level,model_provider,model_name' }).select('id').single();
    if (analysisError) throw analysisError;
    const { data: draft, error: draftError } = await ctx.service.from('pac_review_reply_drafts').insert({
      workspace_id: ctx.workspace.id, review_row_id: review.id,
      draft_text: parsed.replyDraft, status: 'draft',
      model_provider: 'google', model_name: result.model
    }).select('id,draft_text,status').single();
    if (draftError) throw draftError;
    return { analysis: parsed, analysis_id: analysis.id, draft };
  }
  if (action === 'level3-copilot') {
    const reviews = await getReviewRecords(ctx, 120);
    if (reviews.length < 2) return { insufficient_data: true, message: 'The Business Growth Copilot needs at least two genuine synced reviews. No conclusions have been generated from empty or insufficient data.' };
    const evidence = reviews.map((r: any) => ({ id: r.id, rating: r.star_rating, date: r.google_created_at, comment: String(r.comment||'').slice(0,700), reply: String(r.reply_comment||'').slice(0,400) }));
    const runAgent = async (role: string, instruction: string) => {
      const output = await gemini('You are the ' + role + ' for Prime Auto Care. Work only from this review dataset. State uncertainty, do not invent facts, and return useful concise findings. ' + instruction + '\nDATA:\n' + JSON.stringify(evidence));
      return output.text;
    };
    const reviewAnalyst = await runAgent('Review Analyst Agent', 'Identify rating movement, recurring phrases and common service topics.');
    const customerExperience = await runAgent('Customer Experience Agent', 'Identify recurring complaints, positive themes, severity and customer-experience risks.');
    const improvementPlanner = await runAgent('Improvement Planner Agent', 'Suggest practical service-process improvements only when supported by multiple reviews; label tentative ideas.');
    const managementReporter = await runAgent('Management Reporter Agent', 'Prepare a short management summary with evidence IDs and limitations.');
    const coordinator = await gemini('Coordinate these four specialist reports into one actionable Prime Auto Care review brief. Separate verified evidence from hypotheses. Do not invent facts or metrics. Provide 3-5 prioritized actions and evidence IDs.\n' + JSON.stringify({ reviewAnalyst, customerExperience, improvementPlanner, managementReporter }));
    const result = {
      generated_at: new Date().toISOString(), review_count: reviews.length,
      agents: { review_analyst: reviewAnalyst, customer_experience: customerExperience, improvement_planner: improvementPlanner, management_reporter: managementReporter },
      summary: coordinator.text
    };
    const { error } = await ctx.service.from('pac_review_copilot_runs').insert({
      workspace_id: ctx.workspace.id, review_count: reviews.length,
      output: result, model_provider: 'google', model_name: coordinator.model
    });
    if (error) throw error;
    return result;
  }
  if (action === 'publish-reply') {
    requireOwner(ctx);
    if (body.approved !== true) throw new Error('Explicit owner approval is required before publishing a Google reply.');
    const draftId = String(body.draft_id || '');
    const { data: draft, error: draftError } = await ctx.service.from('pac_review_reply_drafts')
      .select('id,review_row_id,draft_text,status').eq('workspace_id', ctx.workspace.id).eq('id', draftId).single();
    if (draftError || !draft) throw new Error('Reply draft could not be found.');
    if (!String(draft.draft_text || '').trim()) throw new Error('Reply draft is empty.');
    if (draft.status === 'published') throw new Error('This reply has already been published.');
    const { data: review, error: reviewError } = await ctx.service.from('pac_google_reviews')
      .select('google_review_id').eq('workspace_id', ctx.workspace.id).eq('id', draft.review_row_id).single();
    if (reviewError || !review) throw new Error('Original Google review could not be found.');
    const settings = await getSettings(ctx);
    const token = await googleAccessToken(ctx);
    const location = await resolveGoogleLocation(ctx, token, settings);
    const reviewId = String(review.google_review_id).split('/').pop();
    const endpoint = 'https://mybusiness.googleapis.com/v4/' + location.accountName + '/locations/' + location.locationName.split('/').pop() + '/reviews/' + reviewId + '/reply';
    await googleFetch(endpoint, token, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment: draft.draft_text }) });
    const now = new Date().toISOString();
    await ctx.service.from('pac_review_reply_drafts').update({
      status: 'published', approved_by: ctx.user.id, approved_at: now,
      published_at: now, updated_at: now
    }).eq('id', draft.id);
    await ctx.service.from('pac_google_reviews').update({
      reply_comment: draft.draft_text, reply_updated_at: now, updated_at: now
    }).eq('id', draft.review_row_id);
    return { published: true, published_at: now };
  }
  return null;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required.' }, 405);
  try {
    const ctx = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const result = await handle(ctx, body);
    if (result === null) return json({ error: 'Unknown Google Reviews action.' }, 400);
    return json(result);
  } catch (error) {
    console.error('Google Review API request failed:', error instanceof Error ? error.message : 'unknown');
    return json({ error: error instanceof Error ? error.message : 'Google Review request failed.' }, 400);
  }
});

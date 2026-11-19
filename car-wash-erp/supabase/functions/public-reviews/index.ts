import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const allowedOrigins = new Set([
  'https://jkjudmkqaebrgllemris.supabase.co',
  'https://zaid404sec.github.io',
  'capacitor://localhost',
  'http://localhost',
  'https://localhost'
]);

function env(name: string) { return Deno.env.get(name)?.trim() || ''; }
function serviceKey() {
  const direct = env('SUPABASE_SERVICE_ROLE_KEY');
  if (direct) return direct;
  try {
    const keys = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}');
    return String(keys.default || Object.values(keys)[0] || '');
  } catch { return ''; }
}
function headers(origin: string) {
  return {
    'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'apikey, content-type, x-client-info',
    'Vary': 'Origin',
    'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
  };
}
function json(origin: string, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers(origin), 'Content-Type': 'application/json' }
  });
}

Deno.serve(async req => {
  const origin = req.headers.get('Origin') || '';
  if (req.method === 'OPTIONS') {
    if (origin && !allowedOrigins.has(origin)) return new Response('Origin not allowed.', { status: 403 });
    return new Response('ok', { headers: headers(origin) });
  }
  if (req.method !== 'GET') return json(origin, { error: 'GET required.' }, 405);
  if (origin && !allowedOrigins.has(origin)) return json(origin, { error: 'Origin not allowed.' }, 403);
  try {
    const url = env('SUPABASE_URL'), key = serviceKey();
    if (!url || !key) throw new Error('Public review feed is not configured.');
    const service = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: workspace, error: workspaceError } = await service.from('washdesk_workspaces')
      .select('id,business_name').eq('business_name', 'Prime Auto Care').limit(1).maybeSingle();
    if (workspaceError || !workspace?.id) throw new Error('Prime Auto Care workspace was not found.');
    const { data, error } = await service.from('pac_google_reviews')
      .select('reviewer_name,star_rating,comment,google_created_at,reply_comment,reply_publication_state')
      .eq('workspace_id', workspace.id)
      .eq('is_removed', false)
      .not('comment', 'is', null)
      .order('google_created_at', { ascending: false })
      .limit(8);
    if (error) throw error;
    const reviews = (data || []).map((row: any) => {
      const state = String(row.reply_publication_state || 'REVIEW_REPLY_STATE_UNSPECIFIED');
      return {
        reviewer_name: String(row.reviewer_name || 'Google customer').slice(0, 100),
        star_rating: Math.max(1, Math.min(5, Number(row.star_rating) || 5)),
        comment: String(row.comment || '').slice(0, 1200),
        created_at: row.google_created_at || null,
        business_reply: state === 'APPROVED' ? String(row.reply_comment || '').slice(0, 1200) : null
      };
    });
    return json(origin, { business_name: workspace.business_name || 'Prime Auto Care', reviews, count: reviews.length, source: 'Google Business Profile API' });
  } catch (error) {
    console.error('Public Google review feed failed:', error instanceof Error ? error.message : 'unknown');
    return json(origin, { business_name: 'Prime Auto Care', reviews: [], count: 0, error: 'Reviews are temporarily unavailable.' }, 200);
  }
});

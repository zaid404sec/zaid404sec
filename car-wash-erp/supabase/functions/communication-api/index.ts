import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

type Channel = 'whatsapp' | 'sms' | 'voice';
type Purpose = 'marketing' | 'service' | 'invoice' | 'opening';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
function env(name: string) { return Deno.env.get(name)?.trim() || ''; }
function normalizePhone(input: unknown): string {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 10) digits = '91' + digits;
  if (!/^[1-9]\d{9,14}$/.test(digits)) throw new Error('Invalid customer mobile number.');
  return '+' + digits;
}
function secretPublishableKey() {
  const legacy = env('SUPABASE_ANON_KEY');
  if (legacy) return legacy;
  try {
    const values = JSON.parse(env('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    return values.default || Object.values(values)[0] || '';
  } catch { return ''; }
}
function secretServiceKey() {
  const legacy = env('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  try {
    const values = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}');
    return values.default || Object.values(values)[0] || '';
  } catch { return ''; }
}
function providerReadiness(config: any) {
  const waMissing = [
    !env('META_ACCESS_TOKEN') && 'META_ACCESS_TOKEN',
    !env('META_APP_SECRET') && 'META_APP_SECRET',
    !env('META_WEBHOOK_VERIFY_TOKEN') && 'META_WEBHOOK_VERIFY_TOKEN',
    !env('META_GRAPH_API_VERSION') && 'META_GRAPH_API_VERSION',
    !(config?.whatsapp_phone_number_id || env('META_PHONE_NUMBER_ID')) && 'WhatsApp Phone Number ID',
    !config?.whatsapp_marketing_template && 'WhatsApp marketing template',
    !config?.whatsapp_invoice_template && 'WhatsApp invoice template'
  ].filter(Boolean);
  const smsMissing = [
    !env('EXOTEL_API_KEY') && 'EXOTEL_API_KEY',
    !env('EXOTEL_API_TOKEN') && 'EXOTEL_API_TOKEN',
    !(config?.exotel_account_sid || env('EXOTEL_ACCOUNT_SID')) && 'Exotel Account SID',
    !config?.dlt_entity_id && 'DLT Entity ID',
    !config?.dlt_sender_id && 'DLT Sender ID / Header',
    !config?.dlt_promo_template_id && 'DLT promotional template ID',
    !config?.dlt_promo_template_text && 'Approved DLT promotional template text',
    !config?.dlt_service_template_id && 'DLT service template ID',
    !config?.dlt_service_template_text && 'Approved DLT service template text'
  ].filter(Boolean);
  const cli = String(config?.exotel_caller_id || env('EXOTEL_CALLER_ID') || '').replace(/\D/g, '');
  const voiceMissing = [
    !env('EXOTEL_API_KEY') && 'EXOTEL_API_KEY',
    !env('EXOTEL_API_TOKEN') && 'EXOTEL_API_TOKEN',
    !(config?.exotel_account_sid || env('EXOTEL_ACCOUNT_SID')) && 'Exotel Account SID',
    !cli && 'Exotel caller ID / ExoPhone',
    !config?.exotel_voice_flow_url && 'Approved Exotel voice flow URL',
    !config?.dlt_entity_id && 'TRAI Principal Entity / DLT Entity ID for commercial voice',
    !config?.dlt_voice_template_id && 'Registered voice content template ID',
    !config?.dlt_voice_template_text && 'Exact registered voice script',
    !/^1(?:40|60)\d{2,}$/.test(cli) && 'TRAI-compliant 140/160 caller ID'
  ].filter(Boolean);
  return {
    whatsapp: { ready: waMissing.length === 0, missing: waMissing },
    sms: { ready: smsMissing.length === 0, missing: smsMissing },
    voice: { ready: voiceMissing.length === 0, missing: voiceMissing },
    automationWorker: { ready: !!env('PAC_WORKER_SECRET'), missing: env('PAC_WORKER_SECRET') ? [] : ['PAC_WORKER_SECRET'] }
  };
}
async function loadWorkspace(service: any, userId: string) {
  const { data: member, error: memberError } = await service
    .from('washdesk_workspace_members').select('workspace_id,role').eq('auth_user_id', userId).maybeSingle();
  if (memberError || !member) throw new Error('This device is not paired with the Prime Auto Care workspace.');
  const { data: workspace, error: workspaceError } = await service
    .from('washdesk_workspaces').select('id,owner_auth_user_id,business_name').eq('id', member.workspace_id).single();
  if (workspaceError || !workspace?.owner_auth_user_id) throw new Error('The shared Prime Auto Care workspace owner could not be found.');
  const { data: sync, error: syncError } = await service
    .from('washdesk_sync').select('payload').eq('user_id', workspace.owner_auth_user_id).single();
  if (syncError || !sync?.payload) throw new Error('Cloud customer data is not available yet. Sync this device and retry.');
  const { data: settings } = await service
    .from('pac_communication_settings').select('*').eq('workspace_id', workspace.id).maybeSingle();
  return { member, workspace, payload: sync.payload, settings: settings || {} };
}
function allowedConfig(input: any) {
  const keys = [
    'whatsapp_business_number','whatsapp_phone_number_id','whatsapp_waba_id',
    'whatsapp_marketing_template','whatsapp_marketing_image_template','whatsapp_invoice_template','whatsapp_opening_template','whatsapp_language',
    'exotel_account_sid','exotel_region','exotel_caller_id','exotel_voice_flow_url',
    'dlt_entity_id','dlt_sender_id','dlt_promo_template_id','dlt_promo_template_text',
    'dlt_service_template_id','dlt_service_template_text','dlt_voice_template_id','dlt_voice_template_text',
    'server_opening_enabled','server_opening_time','server_opening_timezone',
    'server_opening_channels','server_opening_message'
  ];
  const out: Record<string, unknown> = {};
  for (const key of keys) if (input?.[key] !== undefined) out[key] = input[key];
  if (out.exotel_region && !['in','sg'].includes(String(out.exotel_region))) throw new Error('Unsupported Exotel region.');
  if (out.server_opening_channels && (!Array.isArray(out.server_opening_channels) ||
      out.server_opening_channels.some((x: string) => !['whatsapp','sms','voice'].includes(x)))) {
    throw new Error('Opening announcement channels are invalid.');
  }
  if (out.server_opening_time && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(String(out.server_opening_time))) {
    throw new Error('Enter the opening schedule in 24-hour time.');
  }
  if (out.server_opening_timezone && !['Asia/Kolkata'].includes(String(out.server_opening_timezone))) {
    throw new Error('Only Asia/Kolkata is currently supported for the Prime Auto Care opening schedule.');
  }
  if (out.whatsapp_phone_number_id && !/^\d{5,30}$/.test(String(out.whatsapp_phone_number_id))) throw new Error('WhatsApp Phone Number ID is invalid.');
  if (out.whatsapp_waba_id && !/^\d{5,30}$/.test(String(out.whatsapp_waba_id))) throw new Error('WhatsApp Business Account ID is invalid.');
  if (out.dlt_entity_id && !/^\d{10,25}$/.test(String(out.dlt_entity_id))) throw new Error('DLT Entity ID format is invalid.');
  return out;
}
function addJob(rows: any[], args: { workspaceId: string; customer: any; channel: Channel; purpose: Purpose; payload: any; campaignId: string; key: string; scheduledAt?: string }) {
  const customer = args.customer;
  rows.push({
    workspace_id: args.workspaceId,
    campaign_id: args.campaignId,
    customer_id: String(customer.id),
    channel: args.channel,
    purpose: args.purpose,
    recipient_e164: normalizePhone(customer.phone),
    recipient_name: String(customer.name || 'Customer').slice(0, 100),
    status: 'queued',
    payload: args.payload,
    idempotency_key: args.key,
    scheduled_at: args.scheduledAt || new Date().toISOString(),
    max_attempts: 5
  });
}
async function storeMedia(service: any, workspaceId: string, rawBase64: string, mime: string, ext: string) {
  if (!['image/jpeg','image/png','image/webp','application/pdf'].includes(mime)) throw new Error('Unsupported campaign attachment type.');
  const clean = rawBase64.replace(/^data:[^,]+,/, '');
  if (clean.length > 14_000_000) throw new Error('Attachment is too large (maximum 10 MB).');
  const bytes = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
  const path = `${workspaceId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await service.storage.from('pac-communication-media').upload(path, bytes, { contentType: mime, upsert: false });
  if (error) throw new Error('Could not securely store the message attachment: ' + error.message);
  return path;
}
async function insertJobs(service: any, rows: any[]) {
  if (!rows.length) return { queued: 0, duplicate: 0 };
  const { data, error } = await service.from('pac_communication_jobs')
    .upsert(rows, { onConflict: 'workspace_id,idempotency_key', ignoreDuplicates: true })
    .select('id');
  if (error) throw error;
  return { queued: data?.length || 0, duplicate: rows.length - (data?.length || 0) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'POST required.' }, 405);
  try {
    const url = env('SUPABASE_URL');
    const anon = secretPublishableKey();
    const serviceKey = secretServiceKey();
    if (!url || !anon || !serviceKey) throw new Error('Supabase server environment is incomplete.');
    const bearer = req.headers.get('Authorization') || '';
    const token = bearer.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Sign in to the paired Prime Auto Care workspace first.' }, 401);
    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !authData?.user) return json({ error: 'The device session expired. Reconnect this device to cloud sync.' }, 401);
    const service = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await req.json();
    const action = String(body?.action || '');
    const context = await loadWorkspace(service, authData.user.id);
    const { member, workspace, payload } = context;
    const settings = context.settings || {};
    const readiness = providerReadiness(settings);

    if (action === 'status') {
      const { data: recent } = await service.from('pac_communication_jobs')
        .select('id,channel,purpose,recipient_name,status,provider_status,error_message,created_at,scheduled_at')
        .eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(30);
      return json({ ok: true, workspace: { name: workspace.business_name, role: member.role }, providers: readiness, config: settings, jobs: recent || [] });
    }

    if (action === 'save-config') {
      if (member.role !== 'owner') return json({ error: 'Only the Prime Auto Care workspace owner can configure messaging providers.' }, 403);
      const fields = allowedConfig(body.config || {});
      const mergedConfig={...settings,...fields};
      const readinessAfterSave=providerReadiness(mergedConfig);
      if(mergedConfig.server_opening_enabled){
        const channels=mergedConfig.server_opening_channels||[];
        const missing=Array.from(new Set(channels.flatMap((channel:string)=>readinessAfterSave[channel]?.missing||[])));
        if(channels.includes('whatsapp')&&!mergedConfig.whatsapp_opening_template)missing.push('Approved WhatsApp opening template');
        if(channels.includes('sms')&&(!mergedConfig.dlt_promo_template_id||!mergedConfig.dlt_promo_template_text))missing.push('Approved DLT promotional SMS template');
        if(channels.includes('voice')&&(!mergedConfig.dlt_voice_template_id||!mergedConfig.dlt_voice_template_text))missing.push('Registered DLT voice script/template');
        if(missing.length)return json({error:'Complete the provider configuration before enabling the unattended opening schedule.',missing:[...new Set(missing)]},409);
      }
      const { data: saved, error } = await service.from('pac_communication_settings')
        .upsert({ workspace_id: workspace.id, ...fields, updated_by: authData.user.id, updated_at: new Date().toISOString() }, { onConflict: 'workspace_id' })
        .select('*').single();
      if (error) throw error;
      return json({ ok: true, config: saved, providers: providerReadiness(saved) });
    }

    if (action === 'campaign') {
      if (member.role !== 'owner') return json({ error: 'Only the workspace owner can start bulk communication campaigns.' }, 403);
      const channel = String(body.channel || '') as Channel;
      if (!['whatsapp','sms','voice'].includes(channel)) throw new Error('Choose WhatsApp, SMS or voice.');
      const message = String(body.message || '').trim();
      if (!message || message.length > 900) throw new Error('Enter a message of 1–900 characters.');
      if(channel==='voice'&&message.length>55)throw new Error('Voice campaign messages must be 55 characters or fewer for the configured Exotel flow.');
      const scheduledAt = body.scheduled_at ? new Date(body.scheduled_at) : new Date();
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() - 60_000 || scheduledAt.getTime() > Date.now() + 30*24*60*60*1000) {
        throw new Error('Campaign schedule must be now or within the next 30 days.');
      }
      const ready = readiness[channel];
      if (!ready.ready) return json({ error: `${channel.toUpperCase()} provider is not ready.`, missing: ready.missing }, 409);
      const ids = Array.isArray(body.customer_ids) ? [...new Set(body.customer_ids.map(String))].slice(0, 1000) : [];
      if (!ids.length) throw new Error('Select at least one customer.');
      const customers = Array.isArray(payload.customers) ? payload.customers : [];
      const lookup = new Map(customers.map((c: any) => [String(c.id), c]));
      const selected = ids.map(id => lookup.get(id)).filter(Boolean);
      const consent = channel === 'whatsapp'
        ? (c: any) => c.waOptIn === true
        : channel === 'sms' ? (c: any) => c.smsOptIn === true
        : (c: any) => c.voiceOptIn === true;
      const eligible = selected.filter((c: any) => consent(c) && c.phone);
      if (!eligible.length) throw new Error(`No selected customers have valid ${channel.toUpperCase()} marketing consent.`);
      const campaignId = crypto.randomUUID();
      let mediaPath: string | null = null;
      if (body.attachment?.base64) {
        if (!settings.whatsapp_marketing_image_template) return json({ error:'Add an approved WhatsApp image-header template name before attaching a campaign image.' },409);
        const mime = String(body.attachment.mime || '');
        const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
        mediaPath = await storeMedia(service, workspace.id, String(body.attachment.base64), mime, ext);
      }
      const rows: any[] = [];
      for (const customer of eligible) {
        const payloadJob: any = {
          template_name: channel === 'whatsapp' ? (mediaPath ? settings.whatsapp_marketing_image_template : settings.whatsapp_marketing_template) : undefined,
          language: settings.whatsapp_language || 'en',
          message,
          dlt_template_id: settings.dlt_promo_template_id,
          dlt_template_text: settings.dlt_promo_template_text,
          dlt_entity_id: settings.dlt_entity_id,
          dlt_sender_id: settings.dlt_sender_id,
          exotel_caller_id: settings.exotel_caller_id,
          voice_flow_url: settings.exotel_voice_flow_url,
          media_path: mediaPath,
          media_mime: body.attachment?.mime || null,
          media_filename: body.attachment?.name || 'prime-auto-care-offer'
        };
        if (channel === 'voice' && !/^1(?:40|60)\d{2,}$/.test(String(settings.exotel_caller_id || '').replace(/\D/g,''))) {
          throw new Error('Automated commercial voice calls require an approved 140/160 series caller ID in India.');
        }
        if (channel === 'voice') {
          if (!settings.dlt_voice_template_id || !settings.dlt_voice_template_text || !settings.dlt_entity_id) {
            throw new Error('Register your voice script/template and Principal Entity on DLT before queuing commercial voice calls.');
          }
          const variables: Record<string,string> = {
            name:String(customer.name || 'Customer'),
            message,
            business:String(workspace.business_name || 'Prime Auto Care')
          };
          let spoken = String(settings.dlt_voice_template_text);
          for (const [key,value] of Object.entries(variables)) spoken=spoken.replaceAll(`{${key}}`,value);
          if (/\{[a-z_]+\}/i.test(spoken)) throw new Error('The registered voice script contains an unsupported variable.');
          if (spoken.length > 120) throw new Error(`The rendered registered voice script for ${customer.name} is longer than 120 characters. Shorten the approved DLT voice template.`);
          payloadJob.message=spoken;
          payloadJob.voice_text=spoken;
          payloadJob.dlt_voice_template_id=settings.dlt_voice_template_id;
          payloadJob.dlt_voice_template_text=settings.dlt_voice_template_text;
        }
        addJob(rows, { workspaceId: workspace.id, customer, channel, purpose: 'marketing', payload: payloadJob, campaignId, key: `campaign:${campaignId}:${customer.id}:${channel}`, scheduledAt: scheduledAt.toISOString() });
      }
      const inserted = await insertJobs(service, rows);
      return json({ ok: true, campaign_id: campaignId, selected: ids.length, eligible: eligible.length, ...inserted, skipped_consent: selected.length-eligible.length, scheduled_at: scheduledAt.toISOString() });
    }

    if (action === 'invoice') {
      const invoice = body.invoice || {};
      const customer = (Array.isArray(payload.customers) ? payload.customers : []).find((c: any) => String(c.id) === String(invoice.customerId));
      if (!customer?.phone) throw new Error('Invoice customer or saved mobile number could not be found in the shared customer database.');
      const channels: Channel[] = [];
      if (customer.waServiceOptIn === true) channels.push('whatsapp');
      if (customer.smsServiceOptIn === true) channels.push('sms');
      if (!channels.length) return json({ ok: true, queued: 0, skipped: 'Customer has not opted in to automatic invoice notifications. Use manual Share PDF / WhatsApp.' });
      if (body.pdf?.base64) {
        const mime = String(body.pdf.mime || 'application/pdf');
        if (mime !== 'application/pdf') throw new Error('Invoice attachment must be a PDF.');
      }
      const pdfPath = body.pdf?.base64
        ? await storeMedia(service, workspace.id, String(body.pdf.base64), 'application/pdf', 'pdf')
        : null;
      const rows: any[] = [];
      const invoiceNumber = String(invoice.number || '');
      const total = String(invoice.total || '');
      const paid = String(invoice.paid || '');
      const balance = String(invoice.balance || '');
      const date = String(invoice.date || '');
      const vehicle = String(invoice.vehicle || '');
      for (const channel of channels) {
        if (!readiness[channel].ready) continue;
        if(channel==='sms'&&(!settings.dlt_service_template_id||!settings.dlt_service_template_text))continue;
        const payloadJob: any = channel === 'whatsapp' ? {
          template_name: settings.whatsapp_invoice_template,
          language: settings.whatsapp_language || 'en',
          body_params: [String(customer.name || 'Customer'), invoiceNumber, date, total, paid, balance, vehicle],
          document_path: pdfPath,
          document_filename: String(body.pdf?.filename || `Invoice-${invoiceNumber}.pdf`)
        } : {
          dlt_template_id: settings.dlt_service_template_id,
          dlt_template_text: settings.dlt_service_template_text,
          dlt_entity_id: settings.dlt_entity_id,
          dlt_sender_id: settings.dlt_sender_id,
          text_values: { name: customer.name || 'Customer', invoice_number: invoiceNumber, date, total, paid, balance, vehicle }
        };
        addJob(rows, { workspaceId: workspace.id, customer, channel, purpose: 'invoice', payload: payloadJob, campaignId: invoice.id || crypto.randomUUID(), key: `invoice:${invoice.id}:${channel}` });
      }
      const inserted = await insertJobs(service, rows);
      return json({ ok: true, queued: inserted.queued, duplicate: inserted.duplicate, skipped: channels.filter(c => !readiness[c].ready) });
    }

    if (action === 'jobs') {
      const { data: jobs, error } = await service.from('pac_communication_jobs')
        .select('id,channel,purpose,recipient_name,status,provider_status,error_message,created_at,scheduled_at,delivered_at')
        .eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return json({ ok: true, jobs: jobs || [] });
    }
    return json({ error: 'Unknown communications action.' }, 400);
  } catch (error) {
    console.error('Prime Auto Care communication API:', error);
    return json({ error: error instanceof Error ? error.message : 'Communication request failed.' }, 400);
  }
});

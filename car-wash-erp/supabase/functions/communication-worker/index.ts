import { createClient } from 'npm:@supabase/supabase-js@2';

function env(name: string) { return Deno.env.get(name)?.trim() || ''; }
function json(body: unknown, status=200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type':'application/json' } });
}
function normalizeDigits(value: unknown) {
  return String(value || '').replace(/\D/g, '');
}
function substitute(template: string, values: Record<string,string>) {
  let result = template;
  for (const [key,value] of Object.entries(values)) result = result.replaceAll(`{${key}}`, String(value ?? ''));
  if (/\{[a-z_]+\}/i.test(result)) throw new Error('The approved DLT SMS template has an unresolved variable.');
  return result;
}
async function recordEvent(service: any, job: any, type: string, details: any) {
  await service.from('pac_communication_events').insert({
    workspace_id: job.workspace_id, job_id: job.id, channel: job.channel,
    event_type: type, provider_message_id: job.provider_message_id || null,
    details: details || {}
  });
}
async function updateJob(service: any, job: any, values: any) {
  await service.from('pac_communication_jobs').update({ ...values, locked_at: null, updated_at: new Date().toISOString() }).eq('id', job.id);
  await recordEvent(service, job, values.status || 'updated', {
    provider_status: values.provider_status || null,
    error_code: values.error_code || null,
    error_message: values.error_message || null
  });
}
async function getMedia(service: any, path: string) {
  const { data, error } = await service.storage.from('pac-communication-media').download(path);
  if (error || !data) throw new Error('Queued message attachment is missing from private storage.');
  return data;
}
async function uploadWhatsAppMedia(phoneId: string, token: string, blob: Blob, filename: string, mime: string, version: string) {
  const form = new FormData();
  form.set('messaging_product','whatsapp');
  form.set('file', new File([blob], filename, { type: mime }));
  form.set('type', mime);
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/media`, {
    method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:form
  });
  const result = await response.json().catch(()=>({}));
  if (!response.ok || !result.id) throw new Error(`WhatsApp media upload failed (HTTP ${response.status}).`);
  return String(result.id);
}
async function sendWhatsApp(service: any, job: any, config: any) {
  const token = env('META_ACCESS_TOKEN');
  const version = env('META_GRAPH_API_VERSION');
  const phoneId = String(config.whatsapp_phone_number_id || env('META_PHONE_NUMBER_ID') || '');
  if (!token || !version || !phoneId) throw new Error('WhatsApp Cloud API credentials or Phone Number ID are not configured.');
  const to = normalizeDigits(job.recipient_e164);
  let templateName = String(job.payload.template_name || '');
  let components: any[] = [];
  if (job.purpose === 'invoice') {
    templateName = String(config.whatsapp_invoice_template || '');
    if (job.payload.document_path) {
      const blob = await getMedia(service, job.payload.document_path);
      const mediaId = await uploadWhatsAppMedia(phoneId, token, blob, job.payload.document_filename || 'Invoice.pdf', 'application/pdf', version);
      components.push({ type:'header', parameters:[{ type:'document', document:{ id:mediaId, filename:job.payload.document_filename || 'Invoice.pdf' } }] });
    }
    components.push({ type:'body', parameters:(job.payload.body_params || []).map((text:string)=>({ type:'text', text:String(text) })) });
  } else {
    const message = String(job.payload.message || '');
    if (job.payload.media_path) {
      const blob = await getMedia(service, job.payload.media_path);
      const mime = String(job.payload.media_mime || 'image/jpeg');
      const mediaId = await uploadWhatsAppMedia(phoneId, token, blob, job.payload.media_filename || 'Prime-Auto-Care-Offer', mime, version);
      components.push({ type:'header', parameters:[{ type:'image', image:{ id:mediaId } }] });
    }
    let params = [String(job.recipient_name || 'Customer'), message];
    if (job.purpose === 'opening') params = job.payload.body_params || params;
    components.push({ type:'body', parameters:params.map((text:string)=>({ type:'text', text:String(text) })) });
  }
  if (!templateName) throw new Error('An approved WhatsApp template name is not configured.');
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method:'POST',
    headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' },
    body:JSON.stringify({
      messaging_product:'whatsapp',
      recipient_type:'individual',
      to,
      type:'template',
      template:{ name:templateName, language:{ code:String(job.payload.language || config.whatsapp_language || 'en') }, components }
    })
  });
  const result = await response.json().catch(()=>({}));
  if (!response.ok) {
    const error = result?.error;
    const e = new Error(error?.message || `WhatsApp API rejected this message (HTTP ${response.status}).`);
    (e as any).providerCode = String(error?.code || response.status);
    (e as any).retryable = response.status === 429 || response.status >= 500;
    throw e;
  }
  const wamid = result?.messages?.[0]?.id;
  if (!wamid) throw new Error('WhatsApp did not return a message ID.');
  return { provider_message_id:String(wamid), provider_status:'accepted', response:{ message_status:result.message_status || 'accepted' } };
}
async function sendSms(job: any, config: any) {
  const apiKey = env('EXOTEL_API_KEY'), apiToken = env('EXOTEL_API_TOKEN');
  const sid = String(config.exotel_account_sid || env('EXOTEL_ACCOUNT_SID') || '');
  if (!apiKey || !apiToken || !sid) throw new Error('Exotel SMS credentials are not configured.');
  const template = String(job.payload.dlt_template_text || '');
  const textValues = job.payload.text_values || {
    name:job.recipient_name || 'Customer',
    message:job.payload.message || ''
  };
  const message = substitute(template, textValues);
  const sender = String(job.payload.dlt_sender_id || config.dlt_sender_id || '');
  const entity = String(job.payload.dlt_entity_id || config.dlt_entity_id || '');
  const templateId = String(job.payload.dlt_template_id || config.dlt_promo_template_id || '');
  if (!sender || !entity || !templateId) throw new Error('Approved DLT sender/header, entity ID and template ID are required.');
  const region = config.exotel_region === 'sg' ? 'api.exotel.com' : 'api.in.exotel.com';
  const form = new URLSearchParams();
  form.set('From', sender);
  form.set('To', job.recipient_e164);
  form.set('Body', message);
  form.set('DltEntityId', entity);
  form.set('DltTemplateId', templateId);
  form.set('SmsType', job.purpose === 'marketing' ? 'promotional' : 'transactional_opt_in');
  const callbackSecret = env('EXOTEL_WEBHOOK_TOKEN');
  if (callbackSecret) form.set('StatusCallback', `${env('SUPABASE_URL')}/functions/v1/communication-webhook?provider=exotel&token=${encodeURIComponent(callbackSecret)}&job_id=${job.id}`);
  const auth = btoa(`${apiKey}:${apiToken}`);
  const response = await fetch(`https://${region}/v1/Accounts/${sid}/Sms/send.json`, {
    method:'POST', headers:{ Authorization:`Basic ${auth}`, 'Content-Type':'application/x-www-form-urlencoded' }, body:form
  });
  const resultText = await response.text();
  let result: any = {};
  try { result = JSON.parse(resultText); } catch { result = { raw:resultText.slice(0,1000) }; }
  if (!response.ok) {
    const e = new Error(result?.RestException?.Message || `Exotel SMS rejected the message (HTTP ${response.status}).`);
    (e as any).providerCode = String(response.status);
    (e as any).retryable = response.status === 429 || response.status >= 500;
    throw e;
  }
  const sidValue = result?.SMSMessage?.Sid || result?.SMSMessage?.MessageSid || result?.Sid || null;
  return { provider_message_id:sidValue ? String(sidValue) : null, provider_status:'accepted', response:result };
}
async function sendVoice(job: any, config: any) {
  const apiKey = env('EXOTEL_API_KEY'), apiToken = env('EXOTEL_API_TOKEN');
  const sid = String(config.exotel_account_sid || env('EXOTEL_ACCOUNT_SID') || '');
  const callerId = String(config.exotel_caller_id || env('EXOTEL_CALLER_ID') || '');
  const flowUrl = String(config.exotel_voice_flow_url || '');
  const voiceTemplateId = String(job.payload.dlt_voice_template_id || config.dlt_voice_template_id || '');
  const voiceTemplateText = String(job.payload.dlt_voice_template_text || config.dlt_voice_template_text || '');
  const entityId = String(job.payload.dlt_entity_id || config.dlt_entity_id || '');
  if (!apiKey || !apiToken || !sid || !callerId || !flowUrl) throw new Error('Exotel voice account, approved Caller ID and configured voice flow are required.');
  if (!/^1(?:40|60)\d{2,}$/.test(callerId.replace(/\D/g,''))) throw new Error('Automated commercial calls require a compliant 140/160 caller ID in India.');
  if (!voiceTemplateId || !voiceTemplateText || !entityId) throw new Error('Registered DLT voice script/template and Principal Entity are required before automated calls.');
  const region = config.exotel_region === 'sg' ? 'api.exotel.com' : 'api.in.exotel.com';
  const form = new URLSearchParams();
  form.set('From', job.recipient_e164);
  form.set('CallerId', callerId);
  form.set('Url', flowUrl);
  if (job.purpose === 'invoice' || job.purpose === 'service') form.set('CallType','trans');
  form.set('TimeLimit', '60');
  const voiceText = String(job.payload.message || voiceTemplateText).slice(0,55);
  form.set('CustomField', `PAC:${job.id}:${voiceTemplateId}:${voiceText}`);
  const callbackSecret = env('EXOTEL_WEBHOOK_TOKEN');
  if (callbackSecret) {
    form.set('StatusCallback', `${env('SUPABASE_URL')}/functions/v1/communication-webhook?provider=exotel&token=${encodeURIComponent(callbackSecret)}&job_id=${job.id}`);
    form.set('StatusCallbackEvents','terminal');
    form.set('StatusCallbackContentType','application/json');
  }
  const auth = btoa(`${apiKey}:${apiToken}`);
  const response = await fetch(`https://${region}/v1/Accounts/${sid}/Calls/connect.json`, {
    method:'POST', headers:{ Authorization:`Basic ${auth}`, 'Content-Type':'application/x-www-form-urlencoded' }, body:form
  });
  const text = await response.text();
  let result: any = {};
  try { result = JSON.parse(text); } catch { result = { raw:text.slice(0,1000) }; }
  if (!response.ok) {
    const e = new Error(result?.RestException?.Message || `Exotel voice call rejected (HTTP ${response.status}).`);
    (e as any).providerCode = String(response.status);
    (e as any).retryable = response.status === 429 || response.status >= 500;
    throw e;
  }
  const callSid = result?.Call?.Sid || result?.CallSid || result?.sid || null;
  return { provider_message_id:callSid ? String(callSid) : null, provider_status:'queued', response:result };
}
async function enqueueOpening(service: any) {
  const { data: schedules, error } = await service.rpc('pac_claim_due_opening_schedules', { p_limit:5 });
  if (error || !Array.isArray(schedules) || !schedules.length) return 0;
  let total = 0;
  for (const config of schedules) {
    const { data: workspace } = await service.from('washdesk_workspaces').select('owner_auth_user_id,business_name').eq('id', config.workspace_id).single();
    if (!workspace?.owner_auth_user_id) continue;
    const { data: sync } = await service.from('washdesk_sync').select('payload').eq('user_id', workspace.owner_auth_user_id).single();
    const customers = Array.isArray(sync?.payload?.customers) ? sync.payload.customers : [];
    const business = sync?.payload?.business || {};
    const location = [business.address,business.city,business.state].filter(Boolean).join(', ');
    const opening = String(business.openingTime || '08:00'), closing = String(business.closingTime || '20:00');
    const message = String(config.server_opening_message || '')
      .replaceAll('{business}', String(business.name || workspace.business_name || 'Prime Auto Care'))
      .replaceAll('{opening}', opening).replaceAll('{closing}', closing)
      .replaceAll('{location}', location).replaceAll('{phone}', String(business.phone || ''));
    const channels = Array.isArray(config.server_opening_channels) ? config.server_opening_channels : [];
    const rows: any[] = [];
    for (const channel of channels as Channel[]) {
      for (const customer of customers) {
        const allowed = channel === 'whatsapp' ? customer.waOptIn === true
          : channel === 'sms' ? customer.smsOptIn === true : customer.voiceOptIn === true;
        if (!allowed || !customer.phone) continue;
        const payload = channel === 'whatsapp' ? {
          template_name:config.whatsapp_opening_template,
          language:config.whatsapp_language || 'en',
          body_params:[String(customer.name || 'Customer'), String(business.name || 'Prime Auto Care'), opening, closing, location]
        } : channel === 'sms' ? {
          dlt_template_id:config.dlt_promo_template_id,
          dlt_template_text:config.dlt_promo_template_text,
          dlt_entity_id:config.dlt_entity_id, dlt_sender_id:config.dlt_sender_id,
          text_values:{ name:String(customer.name || 'Customer'), message }
        } : (() => {
          let spoken = String(config.dlt_voice_template_text || '');
          const variables: Record<string,string> = {
            name:String(customer.name || 'Customer'),
            business:String(business.name || 'Prime Auto Care'),
            opening,
            closing,
            location,
            phone:String(business.phone || ''),
            message
          };
          for (const [key,value] of Object.entries(variables)) spoken=spoken.replaceAll(`{${key}}`,value);
          if (/\{[a-z_]+\}/i.test(spoken) || spoken.length > 55) {
            throw new Error('The registered DLT opening voice script must resolve every variable and fit within 55 characters for the configured Exotel flow.');
          }
          return {
            message:spoken,
            voice_text:spoken,
            voice_flow_url:config.exotel_voice_flow_url,
            exotel_caller_id:config.exotel_caller_id,
            dlt_voice_template_id:config.dlt_voice_template_id,
            dlt_voice_template_text:config.dlt_voice_template_text,
            dlt_entity_id:config.dlt_entity_id
          };
        })();
        rows.push({
          workspace_id:config.workspace_id, customer_id:String(customer.id), channel, purpose:'opening',
          recipient_e164:jobPhone(customer.phone), recipient_name:String(customer.name || 'Customer'),
          status:'queued', payload, idempotency_key:`opening:${new Date().toLocaleDateString('en-CA',{timeZone:config.server_opening_timezone || 'Asia/Kolkata'})}:${customer.id}:${channel}`,
          max_attempts:5
        });
      }
    }
    if (rows.length) {
      const { data, error:insertError } = await service.from('pac_communication_jobs').upsert(rows,{onConflict:'workspace_id,idempotency_key',ignoreDuplicates:true}).select('id');
      if (insertError) throw insertError;
      total += data?.length || 0;
    }
    // Mark the local business date as enqueued only after all channel jobs
    // have either been durably inserted or the day had no opted-in recipients.
    const dayParts = new Intl.DateTimeFormat('en-CA',{timeZone:config.server_opening_timezone || 'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).reduce((out:any,p:any)=>{if(p.type!=='literal')out[p.type]=p.value;return out;},{} as Record<string,string>);
    const day = `${dayParts.year}-${dayParts.month}-${dayParts.day}`;
    const {error:markError}=await service.from('pac_communication_settings')
      .update({server_opening_last_enqueued:day,updated_at:new Date().toISOString()})
      .eq('workspace_id',config.workspace_id);
    if(markError)throw markError;
  }
  return total;
}
function jobPhone(value: unknown) {
  let digits = String(value || '').replace(/\D/g,'');
  if (digits.length === 10) digits = '91' + digits;
  return '+' + digits;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok');
  const workerSecret = env('PAC_WORKER_SECRET');
  if (!workerSecret || req.headers.get('x-pac-worker-secret') !== workerSecret) return json({ error:'Forbidden' }, 403);
  try {
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY') || (() => {
      try { const k = JSON.parse(env('SUPABASE_SECRET_KEYS') || '{}'); return k.default || Object.values(k)[0] || ''; } catch { return ''; }
    })();
    if (!env('SUPABASE_URL') || !serviceKey) throw new Error('Supabase service role secret is not configured for the worker.');
    const service = createClient(env('SUPABASE_URL'), serviceKey, { auth:{persistSession:false,autoRefreshToken:false} });
    const scheduled = await enqueueOpening(service);
    const { data: jobs, error } = await service.rpc('pac_claim_communication_jobs',{p_limit:25});
    if (error) throw error;
    const results: any[] = [];
    for (const job of jobs || []) {
      try {
        const { data: config } = await service.from('pac_communication_settings').select('*').eq('workspace_id',job.workspace_id).single();
        if (!config) throw new Error('Communication settings are not configured.');
        let result: any;
        if (job.channel === 'whatsapp') result = await sendWhatsApp(service,job,config);
        else if (job.channel === 'sms') result = await sendSms(job,config);
        else result = await sendVoice(job,config);
        await updateJob(service,job,{
          status:'accepted',
          provider_message_id:result.provider_message_id,
          provider_status:result.provider_status,
          provider_response:result.response,
          error_code:null,error_message:null
        });
        results.push({id:job.id,status:'accepted'});
      } catch (error) {
        const retryable = Boolean((error as any)?.retryable) || error instanceof TypeError;
        const attempts = Number(job.attempts || 1);
        const terminal = !retryable || attempts >= Number(job.max_attempts || 5);
        const retryAt = new Date(Date.now() + Math.min(60,Math.pow(2,attempts))*60_000).toISOString();
        await updateJob(service,job,{
          status:terminal?'failed':'queued',
          next_attempt_at:terminal?null:retryAt,
          error_code:String((error as any)?.providerCode || 'COMMUNICATION_ERROR'),
          error_message:error instanceof Error ? error.message : 'Provider request failed.',
          provider_response:{ retryable, attempt:attempts }
        });
        results.push({id:job.id,status:terminal?'failed':'retrying',error:error instanceof Error?error.message:'Provider error'});
      }
    }
    return json({ ok:true, scheduled_opening_jobs:scheduled, processed:results.length, results });
  } catch (error) {
    console.error('Prime Auto Care communication worker:',error);
    return json({ error:error instanceof Error?error.message:'Worker failed.' },500);
  }
});

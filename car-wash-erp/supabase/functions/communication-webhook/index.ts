function env(name: string) { return Deno.env.get(name)?.trim() || ''; }
function response(text: string, status=200, type='text/plain') {
  return new Response(text,{status,headers:{'Content-Type':type}});
}
function bytesToHex(value: ArrayBuffer) {
  return [...new Uint8Array(value)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function verifyMetaSignature(raw: string, signature: string, secret: string) {
  if (!signature.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest = await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw));
  const expected = bytesToHex(digest);
  const supplied = signature.slice(7).toLowerCase();
  if (expected.length !== supplied.length) return false;
  let diff = 0;
  for (let i=0;i<expected.length;i++) diff |= expected.charCodeAt(i)^supplied.charCodeAt(i);
  return diff === 0;
}
function normalizeDigits(value: unknown) {
  let digits=String(value||'').replace(/\D/g,'');
  if(digits.length===10)digits='91'+digits;
  return digits;
}
async function recordCustomerOptOut(service:any,channel:'whatsapp'|'sms',sender:unknown,details:any) {
  const digits=normalizeDigits(sender);
  if(digits.length<11)return {matched:0};
  const {data:workspace,error:workspaceError}=await service.from('washdesk_workspaces')
    .select('id,owner_auth_user_id').limit(1).maybeSingle();
  if(workspaceError||!workspace?.id||!workspace?.owner_auth_user_id)return {matched:0};
  const {data:sync,error:syncError}=await service.from('washdesk_sync')
    .select('payload').eq('user_id',workspace.owner_auth_user_id).single();
  if(syncError||!sync?.payload)return {matched:0};
  const payload=sync.payload;
  const customers=Array.isArray(payload.customers)?payload.customers:[];
  const now=Date.now();
  let matched=0;
  for(const customer of customers){
    if(normalizeDigits(customer.phone)!==digits)continue;
    matched++;
    if(channel==='whatsapp'){
      customer.waOptIn=false;
      customer.waServiceOptIn=false;
    }else{
      customer.smsOptIn=false;
      customer.smsServiceOptIn=false;
    }
    customer.communicationConsentUpdatedAt=now;
    customer.communicationConsentSource='provider-inbound-opt-out';
    customer.communicationConsentHistory=Array.isArray(customer.communicationConsentHistory)?customer.communicationConsentHistory:[];
    customer.communicationConsentHistory.push({channel,field:'all-'+channel+'-consent',granted:false,source:'provider-inbound-opt-out',at:now});
    customer.communicationConsentHistory=customer.communicationConsentHistory.slice(-50);
    customer.updatedAt=now;
  }
  if(matched){
    payload.customers=customers;
    const {error:updateError}=await service.from('washdesk_sync')
      .update({payload,updated_at:new Date().toISOString()})
      .eq('user_id',workspace.owner_auth_user_id);
    if(updateError)throw updateError;
    await service.from('pac_communication_events').insert({
      workspace_id:workspace.id,job_id:null,channel,event_type:'customer_opt_out',
      details:{matched_customers:matched,source:'provider-inbound',provider_details:details||{}}
    });
  }
  return {matched};
}
function isOptOut(value:unknown) {
  const text=String(value||'').trim().toLowerCase().replace(/[.!?]+$/,'');
  return /^(stop|stop all|unsubscribe|un-subscribe|cancel|end|quit|opt ?out|remove me|do not message)$/.test(text);
}
async function serviceClient() {
  const url=env('SUPABASE_URL');
  let key=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!key){try{const parsed=JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}');key=parsed.default||Object.values(parsed)[0]||''}catch{}}
  if(!url||!key)throw new Error('Server database credentials are missing.');
  const {createClient}=await import('npm:@supabase/supabase-js@2');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function setJobStatus(service:any,jobId:string,status:string,providerId:string|null,details:any) {
  const {data:job}=await service.from('pac_communication_jobs').select('id,workspace_id,channel,provider_message_id').eq('id',jobId).maybeSingle();
  if(!job)return;
  const errors=details?.errors;
  const errorText=Array.isArray(errors)&&errors.length?String(errors[0]?.title||errors[0]?.message||'Provider reported a failure'):'';
  const {error}=await service.from('pac_communication_jobs').update({
    status,
    provider_message_id:providerId||job.provider_message_id,
    provider_status:status,
    error_code:errors?.[0]?.code?String(errors[0].code):null,
    error_message:status==='failed'?errorText:null,
    provider_response:details||{},
    sent_at:['sent','delivered','read'].includes(status)?new Date().toISOString():undefined,
    delivered_at:['delivered','read'].includes(status)?new Date().toISOString():undefined,
    updated_at:new Date().toISOString()
  }).eq('id',jobId);
  if(error)throw error;
  await service.from('pac_communication_events').insert({
    workspace_id:job.workspace_id,job_id:job.id,channel:job.channel,event_type:status,
    provider_message_id:providerId||job.provider_message_id,details:details||{}
  });
}
Deno.serve(async(req)=>{
  const url=new URL(req.url);
  const provider=url.searchParams.get('provider')||'whatsapp';
  if(req.method==='GET'&&provider==='whatsapp'){
    const mode=url.searchParams.get('hub.mode');
    const token=url.searchParams.get('hub.verify_token');
    const challenge=url.searchParams.get('hub.challenge')||'';
    if(mode==='subscribe'&&token&&token===env('META_WEBHOOK_VERIFY_TOKEN'))return response(challenge);
    return response('Webhook verification failed',403);
  }
  if(req.method!=='POST')return response('Method not allowed',405);
  try{
    const service=await serviceClient();
    if(provider==='whatsapp'){
      const raw=await req.text();
      const secret=env('META_APP_SECRET');
      const signature=req.headers.get('x-hub-signature-256')||'';
      if(!secret||!(await verifyMetaSignature(raw,signature,secret)))return response('Invalid signature',401);
      const payload=JSON.parse(raw);
      for(const entry of payload.entry||[]){
        for(const change of entry.changes||[]){
          for(const message of change.value?.messages||[]){
            const text=message?.text?.body || message?.button?.text || message?.interactive?.button_reply?.title || message?.interactive?.list_reply?.title || '';
            if(isOptOut(text)){
              const sender=message?.from || change.value?.contacts?.[0]?.wa_id;
              await recordCustomerOptOut(service,'whatsapp',sender,{message_id:message?.id,text});
            }
          }
          for(const statusItem of change.value?.statuses||[]){
            const providerId=String(statusItem.id||'');
            const status=String(statusItem.status||'');
            if(!providerId||!['sent','delivered','read','failed'].includes(status))continue;
            const {data:job}=await service.from('pac_communication_jobs').select('id').eq('provider_message_id',providerId).maybeSingle();
            if(job)await setJobStatus(service,job.id,status,providerId,statusItem);
          }
        }
      }
      return response('EVENT_RECEIVED');
    }
    if(provider==='exotel'){
      const provided=url.searchParams.get('token')||'';
      if(!env('EXOTEL_WEBHOOK_TOKEN')||provided!==env('EXOTEL_WEBHOOK_TOKEN'))return response('Forbidden',403);
      let form:any={};
      const contentType=req.headers.get('content-type')||'';
      if(contentType.includes('application/json'))form=await req.json();
      else if(contentType.includes('application/x-www-form-urlencoded')||contentType.includes('multipart/form-data')){
        const data=await req.formData();for(const [k,v] of data.entries())form[k]=String(v);
      }else{
        const text=await req.text();try{form=JSON.parse(text)}catch{form={raw:text}}
      }
      const inboundBody=form.Body||form.body||form.Message||form.message||'';
      const inboundFrom=form.From||form.from||form.Sender||form.sender||'';
      if(inboundFrom&&isOptOut(inboundBody)){
        await recordCustomerOptOut(service,'sms',inboundFrom,{body:String(inboundBody),from:String(inboundFrom)});
        return response('OK');
      }
      const jobId=url.searchParams.get('job_id')||String(form.CustomField||form.custom_field||'').match(/PAC:([0-9a-f-]{36})/i)?.[1]||'';
      if(!jobId)return response('OK');
      const rawStatus=String(form.Status||form.status||form.CallStatus||form.SmsStatus||'').toLowerCase();
      const isCall=provider==='exotel'&&(form.CallSid||form.Call||form.Direction||form.CallDuration);
      const status=isCall
        ? (['completed','answered','in-progress'].includes(rawStatus)?'delivered':['failed','busy','no-answer','canceled','cancelled'].includes(rawStatus)?'failed':'sent')
        : (['delivered','success','sent'].includes(rawStatus)?'delivered':['failed','undelivered','rejected'].includes(rawStatus)?'failed':'sent');
      await setJobStatus(service,jobId,status,String(form.CallSid||form.SmsSid||form.MessageSid||'')||null,form);
      return response('OK');
    }
    return response('Unknown provider',400);
  }catch(error){
    console.error('Prime Auto Care communication webhook:',error);
    return response('Webhook processing failed',500);
  }
});

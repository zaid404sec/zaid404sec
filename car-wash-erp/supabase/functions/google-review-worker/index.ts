import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

function env(name: string) { return Deno.env.get(name)?.trim() || ''; }
function b64(value: string) {
  const normalized=value.replace(/-/g,'+').replace(/_/g,'/');
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,'=')),c=>c.charCodeAt(0));
}
async function decrypt(value: string) {
  const keyText=env('GOOGLE_TOKEN_ENCRYPTION_KEY');
  if(!keyText)throw new Error('Token encryption key missing.');
  const keyBytes=b64(keyText),raw=b64(value);
  if(keyBytes.length!==32||raw.length<29)throw new Error('Encrypted token invalid.');
  const key=await crypto.subtle.importKey('raw',keyBytes,'AES-GCM',false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12)},key,raw.slice(12));
  return new TextDecoder().decode(plain);
}
async function openRouterKeyForWorkspace(service:any,workspaceId:string) {
  const {data,error}=await service.rpc('pac_get_openrouter_key',{p_workspace_id:workspaceId});
  if(error)throw error;
  return String(data||env('OPENROUTER_API_KEY')||'').trim();
}
function ratingNumber(value: unknown) {
  const map:Record<string,number>={ONE:1,TWO:2,THREE:3,FOUR:4,FIVE:5};
  return map[String(value||'').toUpperCase()]||Number(value)||null;
}
async function serviceClient() {
  const url=env('SUPABASE_URL');let key=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!key){try{const parsed=JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}');key=String(parsed.default||Object.values(parsed)[0]||'')}catch{}}
  if(!url||!key)throw new Error('Supabase service credentials are missing.');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function requestGoogle(url:string,token:string,init:RequestInit={}) {
  const response=await fetch(url,{...init,headers:{Authorization:'Bearer '+token,...(init.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('Google API '+response.status+': '+String(data?.error?.message||'Request failed.'));
  return data;
}
async function readGoogleReplyModeration(token:string,accountName:string,locationName:string,reviewResource:string,expectedReply:string) {
  const expectedId=reviewResource.split('/').pop();
  let lastState='PENDING_VERIFICATION',policyViolation:string|null=null,checkedAt=new Date().toISOString();
  for(let attempt=0;attempt<3;attempt++){
    let pageToken='';
    for(let page=0;page<10;page++){
      const params=new URLSearchParams({pageSize:'50',orderBy:'updateTime desc'});
      if(pageToken)params.set('pageToken',pageToken);
      const data=await requestGoogle('https://mybusiness.googleapis.com/v4/'+accountName+'/locations/'+locationName.split('/').pop()+'/reviews?'+params.toString(),token);
      const item=(data.reviews||[]).find((r:any)=>{
        const resource=String(r.name||'');
        const id=String(r.reviewId||resource.split('/').pop()||'');
        return resource===reviewResource||id===expectedId;
      });
      if(item){
        const moderation=item.reviewReply||{};
        const returnedComment=String(moderation.comment||'');
        if(returnedComment&&returnedComment!==expectedReply){
          return {state:'REPLY_MISMATCH',policyViolation:null,checkedAt:new Date().toISOString()};
        }
        const state=String(moderation.reviewReplyState||'REVIEW_REPLY_STATE_UNSPECIFIED');
        return {state,policyViolation:moderation.policyViolation?String(moderation.policyViolation):null,checkedAt:new Date().toISOString()};
      }
      pageToken=String(data.nextPageToken||'');
      if(!pageToken)break;
    }
    if(attempt<2)await new Promise(resolve=>setTimeout(resolve,800*(attempt+1)));
  }
  return {state:lastState,policyViolation,checkedAt};
}

async function setAutoReplyClaim(service:any,workspaceId:string,googleReviewId:string,state:string,detail:string|null) {
  const {error}=await service.from('pac_google_review_auto_reply_claims').update({
    state,finished_at:new Date().toISOString(),detail:detail?detail.slice(0,900):null
  }).eq('workspace_id',workspaceId).eq('google_review_id',googleReviewId);
  if(error)console.error('Could not update auto-reply claim:',error.message);
}
async function autoReplyForReview(service:any,settings:any,token:string,accountName:string,locationName:string,googleReviewId:string,reviewRow:any,item:any) {
  if(settings.auto_reply_enabled!==true)return {status:'disabled'};
  const rating=ratingNumber(item.starRating);
  const minimum=Math.max(4,Math.min(5,Number(settings.auto_reply_min_rating||5)));
  if(!rating||rating<minimum)return {status:'held_for_owner',reason:'rating_below_threshold'};
  if(item.reviewReply?.comment||reviewRow.reply_comment)return {status:'already_replied'};
  const comment=String(item.comment||'').trim();
  const complaintPattern=/\b(?:bad|poor|worst|terrible|awful|hate|refund|complaint|damage|damaged|scratch|scratched|rude|late|delay|dirty|unclean|problem|issue|unhappy|disappoint(?:ed|ing)?|not satisfied|not good|never again|fraud|scam|careless|broken|missed|overcharged|unsafe|wrong|unacceptable|unprofessional|waste|regret|long wait|no response)\b/i;
  if(complaintPattern.test(comment))return {status:'held_for_owner',reason:'complaint_or_negative_language'};
  if(comment.length>1800)return {status:'held_for_owner',reason:'review_too_long_for_auto_reply'};
  const openRouterKey=await openRouterKeyForWorkspace(service,settings.workspace_id);
  if(comment&& !openRouterKey){
    await service.from('pac_google_review_settings').update({auto_reply_last_error:'The original Workspace Owner has not saved the replacement OpenRouter key in Google Review Center Setup.'}).eq('workspace_id',settings.workspace_id);
    return {status:'held_for_owner',reason:'server_ai_key_missing'};
  }
  const {data:claim,error:claimError}=await service.rpc('pac_claim_google_auto_reply',{
    p_workspace_id:settings.workspace_id,
    p_google_review_id:googleReviewId,
    p_review_row_id:reviewRow.id,
    p_stale_before:new Date(Date.now()-3*60*1000).toISOString()
  });
  if(claimError)throw claimError;
  if(claim!==true)return {status:'already_claimed'};
  try {
    let reply='';
    let modelName='rule-based-five-star-thanks';
    if(comment){
      const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{
        method:'POST',
        headers:{
          'Authorization':'Bearer '+openRouterKey,
          'Content-Type':'application/json',
          'HTTP-Referer':'https://zaid404sec.github.io/zaid404sec/website/',
          'X-Title':'Prime Auto Care WashDesk'
        },
        body:JSON.stringify({
          model:'openrouter/free',
          messages:[
            {role:'system',content:'You write short public owner replies to genuine positive Google reviews for Prime Auto Care in Surat, India. Reply in the same language as the review. Use a warm, professional and natural tone. Thank the customer and acknowledge only what the review actually says. Do not invent a service, visit detail, employee, promise, discount, refund or business fact. Do not ask for a higher rating, a revised review or personal information. Return only the reply text, 45 words maximum.'},
            {role:'user',content:'Google rating: '+rating+' out of 5\\nCustomer review:\\n'+comment}
          ],
          temperature:0.25,
          max_tokens:180
        }),
        signal:AbortSignal.timeout(25000)
      });
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error('OpenRouter AI reply failed ('+response.status+').');
      const content=body?.choices?.[0]?.message?.content;
      reply=Array.isArray(content)?content.map((part:any)=>part?.text||'').join('\\n').trim():String(content||'').trim();
      modelName=String(body?.model||'openrouter/free');
    } else {
      reply='Thank you for choosing Prime Auto Care and for sharing your rating. We truly appreciate your support!';
    }
    if(!reply||reply.length>650)throw new Error('AI reply was empty or exceeded the safe length.');
    const reviewId=googleReviewId.split('/').pop();
    if(!reviewId)throw new Error('Google review resource ID is invalid.');
    const endpoint='https://mybusiness.googleapis.com/v4/'+accountName+'/locations/'+locationName.split('/').pop()+'/reviews/'+reviewId+'/reply';
    await requestGoogle(endpoint,token,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({comment:reply})});
    // Google accepts reply updates asynchronously. Re-read the review with reviews.list
    // and persist its output-only reviewReplyState instead of assuming HTTP 200 is public.
    const moderation=await readGoogleReplyModeration(token,accountName,locationName,googleReviewId,reply);
    const now=new Date().toISOString();
    const {error:draftError}=await service.from('pac_review_reply_drafts').insert({
      workspace_id:settings.workspace_id,
      review_row_id:reviewRow.id,
      draft_text:reply,
      status:'published',
      model_provider:comment?'openrouter':'rule-based',
      model_name:modelName,
      published_at:now,
      google_reply_update_time:now,
      publication_state:moderation.state,
      publication_policy_violation:moderation.policyViolation,
      publication_checked_at:moderation.checkedAt,
      publication_error:null
    });
    if(draftError)throw draftError;
    const {error:reviewError}=await service.from('pac_google_reviews').update({
      reply_comment:reply,reply_updated_at:now,reply_publication_state:moderation.state,
      reply_policy_violation:moderation.policyViolation,reply_state_checked_at:moderation.checkedAt,updated_at:now
    }).eq('workspace_id',settings.workspace_id).eq('id',reviewRow.id);
    if(reviewError)throw reviewError;
    await setAutoReplyClaim(service,settings.workspace_id,googleReviewId,'published',null);
    await service.from('pac_google_review_settings').update({
      auto_reply_last_error:null,auto_reply_last_sent_at:now
    }).eq('workspace_id',settings.workspace_id);
    return {status:'submitted',publication_state:moderation.state,policy_violation:moderation.policyViolation,rating,model:modelName};
  } catch(error) {
    const message=error instanceof Error?error.message:'Automatic reply failed.';
    await setAutoReplyClaim(service,settings.workspace_id,googleReviewId,'failed',message);
    await service.from('pac_google_review_settings').update({
      auto_reply_last_error:message.slice(0,900)
    }).eq('workspace_id',settings.workspace_id);
    throw error;
  }
}
async function syncWorkspace(service:any,settings:any,targetReviewName:string|null) {
  const workspaceId=settings.workspace_id;
  const {data:credentials,error}=await service.from('pac_google_oauth_credentials').select('*').eq('workspace_id',workspaceId).maybeSingle();
  if(error)throw error;
  if(!credentials?.encrypted_refresh_token)throw new Error('Owner OAuth is not connected.');
  let token='';
  const expiry=credentials.access_token_expires_at?Date.parse(credentials.access_token_expires_at):0;
  if(credentials.encrypted_access_token&&expiry>Date.now()+90000)token=await decrypt(credentials.encrypted_access_token);
  else {
    const refreshToken=await decrypt(credentials.encrypted_refresh_token);
    const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({
      client_id:env('GOOGLE_OAUTH_CLIENT_ID'),client_secret:env('GOOGLE_OAUTH_CLIENT_SECRET'),
      refresh_token:refreshToken,grant_type:'refresh_token'
    })});
    const body=await response.json().catch(()=>({}));
    if(!response.ok||!body.access_token)throw new Error('Google token refresh failed.');
    token=String(body.access_token);
    const keyBytes=b64(env('GOOGLE_TOKEN_ENCRYPTION_KEY')),key=await crypto.subtle.importKey('raw',keyBytes,'AES-GCM',false,['encrypt']);
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(token));
    const encoded=btoa(String.fromCharCode(...new Uint8Array([...iv,...new Uint8Array(encrypted)]))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
    await service.from('pac_google_oauth_credentials').update({
      encrypted_access_token:encoded,
      access_token_expires_at:new Date(Date.now()+Number(body.expires_in||3600)*1000).toISOString(),
      updated_at:new Date().toISOString()
    }).eq('workspace_id',workspaceId);
  }
  let accountName=String(settings.google_account_resource_name||''),locationName=String(settings.google_location_resource_name||'');
  if(!accountName||!locationName) {
    const accountData=await requestGoogle('https://mybusinessaccountmanagement.googleapis.com/v1/accounts',token);
    const accounts=accountData.accounts||[];
    const target=String(settings.google_business_profile_id||'13506481990772076097');
    const found=[];
    for(const account of accounts) {
      const endpoint='https://mybusinessbusinessinformation.googleapis.com/v1/'+account.name+'/locations?'+new URLSearchParams({readMask:'name,title,storefrontAddress,websiteUri,metadata',pageSize:'100'});
      const items=await requestGoogle(endpoint,token);
      for(const loc of items.locations||[]) {
        const id=String(loc.name||'').split('/').pop();
        const title=String(loc.title||'').toLowerCase().trim();
        if(id===target||title==='prime auto care')found.push({accountName:account.name,locationName:loc.name});
      }
    }
    const unique=[...new Map(found.map(x=>[x.locationName,x])).values()];
    if(unique.length!==1)throw new Error(unique.length?'More than one Prime Auto Care location matched.':'No API location matched the supplied Profile ID.');
    accountName=String(unique[0].accountName);locationName=String(unique[0].locationName);
  }
  const locationId=locationName.split('/').pop();
  let pageToken='',fetched=0,inserted=0,updated=0;
  let autoReply:Record<string,unknown>|null=null;
  for(let page=0;page<10;page++) {
    const params=new URLSearchParams({pageSize:'50',orderBy:'updateTime desc'});
    if(pageToken)params.set('pageToken',pageToken);
    const result=await requestGoogle('https://mybusiness.googleapis.com/v4/'+accountName+'/locations/'+locationId+'/reviews?'+params.toString(),token);
    for(const item of result.reviews||[]) {
      const resource=String(item.name||item.reviewId||'');if(!resource)continue;
      const {data:prior}=await service.from('pac_google_reviews').select('id').eq('workspace_id',workspaceId).eq('google_review_id',resource).maybeSingle();
      const {data:reviewRow,error:upsertError}=await service.from('pac_google_reviews').upsert({
        workspace_id:workspaceId,google_review_id:resource,reviewer_name:item.reviewer?.displayName||null,
        reviewer_profile_url:item.reviewer?.profilePhotoUrl||null,star_rating:ratingNumber(item.starRating),
        comment:item.comment||'',google_created_at:item.createTime||null,google_updated_at:item.updateTime||null,
        reply_comment:item.reviewReply?.comment||null,reply_updated_at:item.reviewReply?.updateTime||null,
        reply_publication_state:item.reviewReply?.reviewReplyState||'REVIEW_REPLY_STATE_UNSPECIFIED',
        reply_policy_violation:item.reviewReply?.policyViolation||null,
        reply_state_checked_at:item.reviewReply?.reviewReplyState?new Date().toISOString():null,
        is_removed:false,raw_payload:item,last_fetched_at:new Date().toISOString(),updated_at:new Date().toISOString()
      },{onConflict:'workspace_id,google_review_id'}).select('id,reply_comment').single();
      if(upsertError)throw upsertError;
      fetched++;if(prior?.id)updated++;else inserted++;
      // Only a Pub/Sub event's exact review resource is eligible. Routine/manual full syncs
      // never auto-publish replies to historical reviews.
      if(targetReviewName && resource===targetReviewName && settings.auto_reply_enabled===true) {
        try {
          autoReply=await autoReplyForReview(service,settings,token,accountName,locationName,resource,reviewRow,item);
        } catch(error) {
          const message=error instanceof Error?error.message:'Auto-reply failed.';
          autoReply={status:'failed',error:message};
        }
      }
    }
    pageToken=String(result.nextPageToken||'');if(!pageToken)break;
  }
  const now=new Date().toISOString();
  await service.from('pac_google_review_settings').upsert({
    workspace_id:workspaceId,google_account_resource_name:accountName,google_location_resource_name:locationName,
    api_status:'connected',last_successful_sync_at:now,last_sync_error:null,updated_at:now
  },{onConflict:'workspace_id'});
  await service.from('pac_google_review_sync_logs').insert({
    workspace_id:workspaceId,sync_source:targetReviewName?'pubsub':'scheduled',status:'success',
    fetched_count:fetched,inserted_count:inserted,updated_count:updated,completed_at:now
  });
  return {workspace_id:workspaceId,fetched,inserted,updated,auto_reply:autoReply};
}
Deno.serve(async req=>{
  if(req.method!=='POST')return new Response('POST required.',{status:405});
  const secret=env('GOOGLE_REVIEW_WORKER_SECRET');
  if(!secret||req.headers.get('x-google-review-worker-secret')!==secret)return new Response('Unauthorized',{status:401});
  try {
    const service=await serviceClient();
    const body=await req.json().catch(()=>({}));
    const eventId=String(body?.event_id||'');
    let targetReviewName:string|null=null,workspaceFilter:string|null=null;
    if(eventId) {
      const {data:event,error:eventError}=await service.from('pac_google_review_events')
        .select('id,workspace_id,review_name,notification_type').eq('id',eventId).maybeSingle();
      if(eventError)throw eventError;
      if(!event)throw new Error('The Pub/Sub review event could not be found.');
      workspaceFilter=event.workspace_id;
      targetReviewName=String(event.review_name||'')||null;
      if(!['NEW_REVIEW','UPDATED_REVIEW'].includes(String(event.notification_type||'')))targetReviewName=null;
    }
    let query=service.from('pac_google_review_settings').select('*').in('api_status',['connected','error']);
    if(workspaceFilter)query=query.eq('workspace_id',workspaceFilter);
    const {data:settings,error}=await query;
    if(error)throw error;
    const results=[];
    for(const row of settings||[]) {
      try { results.push({ok:true,...await syncWorkspace(service,row,targetReviewName)}); }
      catch(error) {
        const message=error instanceof Error?error.message:'Google review sync failed.';
        await service.from('pac_google_review_settings').update({api_status:'error',last_sync_error:message.slice(0,1000),updated_at:new Date().toISOString()}).eq('workspace_id',row.workspace_id);
        await service.from('pac_google_review_sync_logs').insert({workspace_id:row.workspace_id,sync_source:targetReviewName?'pubsub':'scheduled',status:'failed',error_summary:message.slice(0,1000),completed_at:new Date().toISOString()});
        results.push({ok:false,workspace_id:row.workspace_id,error:message});
      }
    }
    const failed=results.some((row:any)=>!row.ok||row.auto_reply?.status==='failed');
    return new Response(JSON.stringify({ok:!failed,workspaces:results.length,results}),{status:failed&&eventId?502:200,headers:{'Content-Type':'application/json'}});
  } catch(error) {
    console.error('Google review event sync failed:',error instanceof Error?error.message:'unknown');
    return new Response(JSON.stringify({error:'Google review event sync failed.'}),{status:500,headers:{'Content-Type':'application/json'}});
  }
});

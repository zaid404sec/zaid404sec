import { createClient } from 'npm:@supabase/supabase-js@2';

function env(name: string) { return Deno.env.get(name)?.trim() || ''; }
function b64(value: string) {
  const normalized=value.replace(/-/g,'+').replace(/_/g,'/');
  return Uint8Array.from(atob(normalized.padEnd(Math.ceil(normalized.length/4)*4,'=')),c=>c.charCodeAt(0));
}
async function decrypt(value: string) {
  const keyText=env('GOOGLE_TOKEN_ENCRYPTION_KEY');
  if(!keyText)throw new Error('Token encryption key missing.');
  const keyBytes=b64(keyText), raw=b64(value);
  if(keyBytes.length!==32||raw.length<29)throw new Error('Encrypted token invalid.');
  const key=await crypto.subtle.importKey('raw',keyBytes,'AES-GCM',false,['decrypt']);
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12)},key,raw.slice(12));
  return new TextDecoder().decode(plain);
}
function ratingNumber(value: unknown) {
  const map:Record<string,number>={ONE:1,TWO:2,THREE:3,FOUR:4,FIVE:5};
  return map[String(value||'').toUpperCase()]||Number(value)||null;
}
async function serviceClient() {
  const url=env('SUPABASE_URL');let key=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!key){try{const parsed=JSON.parse(env('SUPABASE_SECRET_KEYS')||'{}');key=parsed.default||Object.values(parsed)[0]||''}catch{}}
  if(!url||!key)throw new Error('Supabase service credentials are missing.');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
async function requestGoogle(url:string,token:string,init:RequestInit={}) {
  const response=await fetch(url,{...init,headers:{Authorization:'Bearer '+token,...(init.headers||{})}});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('Google API '+response.status+': '+String(data?.error?.message||'Request failed.'));
  return data;
}
async function syncWorkspace(service:any,settings:any) {
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
    // Worker updates the encrypted access token through the API function after its next owner sync.
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
  for(let page=0;page<10;page++) {
    const params=new URLSearchParams({pageSize:'50',orderBy:'updateTime desc'});
    if(pageToken)params.set('pageToken',pageToken);
    const result=await requestGoogle('https://mybusiness.googleapis.com/v4/'+accountName+'/locations/'+locationId+'/reviews?'+params.toString(),token);
    for(const item of result.reviews||[]) {
      const resource=String(item.name||item.reviewId||'');if(!resource)continue;
      const {data:prior}=await service.from('pac_google_reviews').select('id').eq('workspace_id',workspaceId).eq('google_review_id',resource).maybeSingle();
      const {error}=await service.from('pac_google_reviews').upsert({
        workspace_id:workspaceId,google_review_id:resource,reviewer_name:item.reviewer?.displayName||null,
        reviewer_profile_url:item.reviewer?.profilePhotoUrl||null,star_rating:ratingNumber(item.starRating),
        comment:item.comment||'',google_created_at:item.createTime||null,google_updated_at:item.updateTime||null,
        reply_comment:item.reviewReply?.comment||null,reply_updated_at:item.reviewReply?.updateTime||null,
        is_removed:false,raw_payload:item,last_fetched_at:new Date().toISOString(),updated_at:new Date().toISOString()
      },{onConflict:'workspace_id,google_review_id'});
      if(error)throw error;fetched++;if(prior?.id)updated++;else inserted++;
    }
    pageToken=String(result.nextPageToken||'');if(!pageToken)break;
  }
  const now=new Date().toISOString();
  await service.from('pac_google_review_settings').upsert({
    workspace_id:workspaceId,google_account_resource_name:accountName,google_location_resource_name:locationName,
    api_status:'connected',last_successful_sync_at:now,last_sync_error:null,updated_at:now
  },{onConflict:'workspace_id'});
  await service.from('pac_google_review_sync_logs').insert({
    workspace_id:workspaceId,sync_source:'scheduled',status:'success',
    fetched_count:fetched,inserted_count:inserted,updated_count:updated,completed_at:now
  });
  return {workspace_id:workspaceId,fetched,inserted,updated};
}
Deno.serve(async req=>{
  if(req.method!=='POST')return new Response('POST required.',{status:405});
  const secret=env('GOOGLE_REVIEW_WORKER_SECRET');
  if(!secret||req.headers.get('x-google-review-worker-secret')!==secret)return new Response('Unauthorized',{status:401});
  try {
    const service=await serviceClient();
    const {data:settings,error}=await service.from('pac_google_review_settings').select('*').in('api_status',['connected','error']);
    if(error)throw error;
    const results=[];
    for(const row of settings||[]) {
      try { results.push({ok:true,...await syncWorkspace(service,row)}); }
      catch(error) {
        const message=error instanceof Error?error.message:'Google review sync failed.';
        await service.from('pac_google_review_settings').update({api_status:'error',last_sync_error:message.slice(0,1000),updated_at:new Date().toISOString()}).eq('workspace_id',row.workspace_id);
        await service.from('pac_google_review_sync_logs').insert({workspace_id:row.workspace_id,sync_source:'scheduled',status:'failed',error_summary:message.slice(0,1000),completed_at:new Date().toISOString()});
        results.push({ok:false,workspace_id:row.workspace_id,error:message});
      }
    }
    return new Response(JSON.stringify({ok:true,workspaces:results.length,results}),{headers:{'Content-Type':'application/json'}});
  } catch(error) {
    console.error('Google review scheduled sync failed:',error instanceof Error?error.message:'unknown');
    return new Response(JSON.stringify({error:'Scheduled Google review sync failed.'}),{status:500,headers:{'Content-Type':'application/json'}});
  }
});

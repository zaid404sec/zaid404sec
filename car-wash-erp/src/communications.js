function bytesToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const step = 0x8000;
  for (let i=0;i<bytes.length;i+=step) binary += String.fromCharCode(...bytes.subarray(i,i+step));
  return btoa(binary);
}
async function api(action,body={}) {
  const context = await window.WashDeskCloud?.getApiContext?.();
  if (!context?.url || !context?.anonKey || !context?.accessToken) {
    throw new Error('Connect this device to the shared Prime Auto Care cloud before using automatic messaging.');
  }
  const response = await fetch(`${context.url}/functions/v1/communication-api`,{
    method:'POST',
    headers:{
      'Content-Type':'application/json',
      apikey:context.anonKey,
      Authorization:`Bearer ${context.accessToken}`
    },
    body:JSON.stringify({action,...body})
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) {
    const error = new Error(data.error || `Communications service returned HTTP ${response.status}.`);
    error.details = data.missing || null;
    error.status = response.status;
    throw error;
  }
  return data;
}
async function ensureCloudIsCurrent(database) {
  if (database && window.WashDeskCloud?.syncNow) await window.WashDeskCloud.syncNow(database);
}
async function attachmentToBase64(file) {
  if (!file) return null;
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPG, PNG or WEBP campaign image.');
  if (file.size > 10*1024*1024) throw new Error('Campaign image must be 10 MB or smaller.');
  return { name:file.name || 'Prime-Auto-Care-Offer',mime:file.type,base64:bytesToBase64(await file.arrayBuffer()) };
}
async function invoiceToBase64(blob) {
  if (!(blob instanceof Blob) || blob.type !== 'application/pdf') throw new Error('The invoice PDF could not be prepared.');
  if (blob.size > 9*1024*1024) throw new Error('Invoice PDF is larger than the 9 MB automation limit. Use manual PDF sharing instead.');
  return { filename:'Prime-Auto-Care-Invoice.pdf',mime:'application/pdf',base64:bytesToBase64(await blob.arrayBuffer()) };
}
window.PrimeAutoCareMessaging = {
  async status() { return api('status'); },
  async saveConfig(config) { return api('save-config',{config}); },
  async campaign({channel,customerIds,message,attachment,scheduledAt,database}) {
    await ensureCloudIsCurrent(database);
    const media = await attachmentToBase64(attachment);
    return api('campaign',{
      channel,
      customer_ids:customerIds,
      message,
      attachment:media,
      scheduled_at:scheduledAt || null
    });
  },
  async sendInvoice({invoice,customer,pdfBlob,database,paidAmount,balanceDue}) {
    await ensureCloudIsCurrent(database);
    const pdf=await invoiceToBase64(pdfBlob);
    return api('invoice',{
      invoice:{
        id:invoice.id,
        customerId:invoice.customerId,
        number:invoice.number,
        date:invoice.date,
        total:String(invoice.grandTotal),
        paid:String(paidAmount ?? ''),
        balance:String(balanceDue ?? ''),
        vehicle:String(invoice.vehicleNumber||'')
      },
      customer:{id:customer?.id,name:customer?.name,phone:customer?.phone},
      pdf
    });
  },
  async jobs() { return api('jobs'); }
};

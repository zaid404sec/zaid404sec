import {
  bad, corsHeaders, decryptToken, getConnection, getTemplate, json,
  makeTemplateComponents, normalizePhone, requireWorkspace, serviceClient,
} from "../_shared/whatsapp.ts";

const BUCKET = "prime-auto-care-whatsapp-invoices";

async function getBusinessPayload(admin: ReturnType<typeof serviceClient>, ownerId: string) {
  const { data, error } = await admin.from("washdesk_sync").select("payload").eq("user_id", ownerId).maybeSingle();
  if (error || !data?.payload) throw new Error("The shared Prime Auto Care customer and invoice data could not be loaded.");
  return data.payload;
}
async function getToken(connection: any) {
  return await decryptToken(connection.access_token_ciphertext, connection.access_token_iv);
}
async function kickDispatcher() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !key) return;
  try {
    await fetch(url.replace(/\/$/, "") + "/functions/v1/whatsapp-dispatch", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
      body: "{}",
    });
  } catch (error) {
    console.warn("WhatsApp queue will be picked up by the scheduled dispatcher:", error);
  }
}
function asStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? "").trim()).filter(Boolean).slice(0, 10);
}
async function ensureInvoicePdf(admin: ReturnType<typeof serviceClient>, ownerId: string, invoiceId: string, pdfBase64: string, filename: string) {
  if (!pdfBase64) return null;
  if (pdfBase64.length > 6_500_000) throw new Error("The invoice PDF is too large for WhatsApp automatic upload. Use Share PDF from the invoice screen.");
  const clean = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const bucket = admin.storage.from(BUCKET);
  const { data: buckets } = await admin.storage.listBuckets();
  if (!(buckets || []).some((b: any) => b.name === BUCKET)) {
    const { error: createError } = await admin.storage.createBucket(BUCKET, { public: false, fileSizeLimit: "8MiB", allowedMimeTypes: ["application/pdf"] });
    if (createError && !String(createError.message || "").toLowerCase().includes("already exists")) throw createError;
  }
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, "-").slice(0, 100) || "invoice.pdf";
  const objectPath = `${ownerId}/${invoiceId}/${safeName}`;
  const { error: uploadError } = await bucket.upload(objectPath, bytes, { contentType: "application/pdf", upsert: true });
  if (uploadError) throw new Error("The invoice PDF could not be uploaded to secure storage: " + uploadError.message);
  const { data: signed, error: signedError } = await bucket.createSignedUrl(objectPath, 3600);
  if (signedError || !signed?.signedUrl) throw new Error("A temporary secure invoice PDF link could not be created.");
  return signed.signedUrl;
}
async function saveJobs(admin: ReturnType<typeof serviceClient>, jobs: any[]) {
  if (!jobs.length) return [];
  const { data, error } = await admin.from("washdesk_whatsapp_jobs").upsert(jobs, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id");
  if (error) throw error;
  return data || [];
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad("Use POST for WhatsApp automation.", 405);
  try {
    const { user, workspace, admin } = await requireWorkspace(req, true);
    const body = await req.json();
    const action = String(body?.action || "");
    const connection = await getConnection(admin, user.id);
    if (connection.is_on_biz_app !== true) throw new Error("The WhatsApp number is not confirmed in Business App Coexistence mode.");
    const token = await getToken(connection);

    if (action === "status") {
      return json({ connected: true, displayPhoneNumber: connection.display_phone_number, verifiedName: connection.verified_name, coexistence: connection.is_on_biz_app, wabaId: connection.waba_id, phoneNumberId: connection.phone_number_id });
    }

    if (action === "templates") {
      const response = await (await import("../_shared/whatsapp.ts")).graphRequest(token, `/${connection.waba_id}/message_templates?fields=id,name,status,category,language,components&limit=100`);
      const approved = (response?.data || []).filter((t: any) => t.status === "APPROVED");
      return json({ templates: approved.map((t: any) => ({
        id: t.id, name: t.name, language: t.language, category: t.category,
        components: (t.components || []).map((c: any) => ({ type: c.type, format: c.format, text: c.text || "" })),
      })) });
    }

    if (action === "preferences") {
      const invoiceTemplateName = String(body?.invoiceTemplateName || "").trim();
      const invoiceLanguageCode = String(body?.invoiceLanguageCode || "en").trim();
      if (invoiceTemplateName) {
        await getTemplate(token, connection.waba_id, invoiceTemplateName, invoiceLanguageCode);
      }
      const { error } = await admin.from("washdesk_whatsapp_preferences").upsert({
        owner_user_id: user.id,
        workspace_id: workspace.workspace_id,
        invoice_template_name: invoiceTemplateName || null,
        invoice_language_code: invoiceLanguageCode,
        updated_at: new Date().toISOString(),
      }, { onConflict: "owner_user_id" });
      if (error) throw error;
      return json({ saved: true });
    }

    if (action === "campaign") {
      const templateName = String(body?.templateName || "").trim();
      const languageCode = String(body?.languageCode || "en").trim();
      const bodyParameters = asStringArray(body?.bodyParameters);
      const headerImageUrl = String(body?.headerImageUrl || "").trim();
      if (!templateName) return bad("Choose an approved marketing template first.");
      if (headerImageUrl && !headerImageUrl.startsWith("https://")) return bad("The promotional image URL must be HTTPS.");
      const template = await getTemplate(token, connection.waba_id, templateName, languageCode);
      const payload = await getBusinessPayload(admin, workspace.owner_user_id);
      const customers = Array.isArray(payload.customers) ? payload.customers : [];
      const selectedIds = Array.isArray(body?.customerIds) ? new Set(body.customerIds.map(String)) : null;
      const recipients = customers.filter((c: any) =>
        c?.waOptIn === true &&
        (!selectedIds || selectedIds.has(String(c.id))) &&
        normalizePhone(c.phone).length >= 11
      );
      if (!recipients.length) return bad("No selected customers have both a valid mobile number and recorded WhatsApp offer permission.");
      if (recipients.length > 300) return bad("A single campaign is limited to 300 customers. Split larger campaigns into smaller batches.");
      const campaignId = crypto.randomUUID();
      const jobs = recipients.map((c: any) => {
        // Validate template variables before adding the job to the queue.
        makeTemplateComponents(template, bodyParameters, c.name || "", headerImageUrl || undefined);
        return {
          owner_user_id: user.id,
          workspace_id: workspace.workspace_id,
          customer_id: String(c.id),
          recipient_name: String(c.name || "Customer"),
          to_phone: normalizePhone(c.phone),
          source_type: "campaign",
          source_id: campaignId,
          template_name: templateName,
          language_code: languageCode,
          body_parameters: bodyParameters,
          header_image_url: headerImageUrl || null,
          status: "queued",
          idempotency_key: `campaign:${campaignId}:${c.id}`,
          scheduled_at: new Date().toISOString(),
        };
      });
      await saveJobs(admin, jobs);
      await kickDispatcher();
      return json({ queued: jobs.length, campaignId, message: `Queued ${jobs.length} WhatsApp messages. Delivery results will arrive through the WhatsApp webhook.` });
    }

    if (action === "invoice") {
      const invoiceId = String(body?.invoiceId || "");
      const payload = await getBusinessPayload(admin, workspace.owner_user_id);
      const invoice = (payload.invoices || []).find((i: any) => String(i.id) === invoiceId);
      if (!invoice || invoice.cancelled) return bad("The invoice could not be found or has been cancelled.");
      if (!invoice.customerId) return json({ queued: false, skipped: true, reason: "This is a walk-in invoice without a saved customer phone number." });
      const customer = (payload.customers || []).find((c: any) => String(c.id) === String(invoice.customerId));
      if (!customer || customer.whatsappInvoiceOptIn !== true) {
        return json({ queued: false, skipped: true, reason: "The customer has not recorded permission to receive invoice messages on WhatsApp." });
      }
      const phone = normalizePhone(customer.phone);
      if (phone.length < 11) return json({ queued: false, skipped: true, reason: "The customer has no valid mobile number." });
      const { data: prefs } = await admin.from("washdesk_whatsapp_preferences").select("*").eq("owner_user_id", user.id).maybeSingle();
      const templateName = String(prefs?.invoice_template_name || "").trim();
      const languageCode = String(prefs?.invoice_language_code || "en");
      if (!templateName) return json({ queued: false, skipped: true, reason: "Set an approved invoice Utility template in Business settings first." });
      const template = await getTemplate(token, connection.waba_id, templateName, languageCode);
      const bodyParameters = [
        String(customer.name || "Customer"),
        String(invoice.number || ""),
        Number(invoice.grandTotal || 0).toFixed(2),
        Math.max(0, Number(invoice.grandTotal || 0) - Number(invoice.paidAmount || 0)).toFixed(2),
      ];
      let documentUrl: string | null = null;
      if (body?.pdfBase64) {
        documentUrl = await ensureInvoicePdf(admin, user.id, invoiceId, String(body.pdfBase64), String(body.filename || `Prime-Auto-Care-${invoice.number}.pdf`));
      }
      makeTemplateComponents(template, bodyParameters, customer.name || "", undefined, documentUrl || undefined, String(body.filename || "Prime-Auto-Care-Invoice.pdf"));
      const jobs = [{
        owner_user_id: user.id,
        workspace_id: workspace.workspace_id,
        customer_id: String(customer.id),
        recipient_name: String(customer.name || "Customer"),
        to_phone: phone,
        source_type: "invoice",
        source_id: invoiceId,
        template_name: templateName,
        language_code: languageCode,
        body_parameters: bodyParameters,
        header_document_url: documentUrl,
        header_document_name: String(body.filename || `Prime-Auto-Care-${invoice.number}.pdf`),
        status: "queued",
        idempotency_key: `invoice:${invoiceId}`,
        scheduled_at: new Date().toISOString(),
      }];
      await saveJobs(admin, jobs);
      await kickDispatcher();
      return json({ queued: jobs.length > 0, message: "Invoice WhatsApp notification queued. PDF is attached when the approved template has a DOCUMENT header." });
    }

    if (action === "schedule-opening") {
      const dailyTime = String(body?.dailyTime || "");
      const timezone = String(body?.timezone || "Asia/Kolkata");
      const templateName = String(body?.templateName || "").trim();
      const languageCode = String(body?.languageCode || "en");
      const bodyParameters = asStringArray(body?.bodyParameters);
      const headerImageUrl = String(body?.headerImageUrl || "").trim();
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(dailyTime)) return bad("Opening announcement time must be in HH:MM format.");
      if (!templateName) return bad("Choose an approved opening-announcement Marketing template.");
      if (!["Asia/Kolkata"].includes(timezone)) return bad("Only Asia/Kolkata is currently enabled for this business workspace.");
      if (headerImageUrl && !headerImageUrl.startsWith("https://")) return bad("The promotional image URL must be HTTPS.");
      const template = await getTemplate(token, connection.waba_id, templateName, languageCode);
      makeTemplateComponents(template, bodyParameters, "Customer", headerImageUrl || undefined);
      const { data: existing } = await admin.from("washdesk_whatsapp_schedules").select("id").eq("owner_user_id", user.id).eq("title", "Daily opening announcement").maybeSingle();
      const schedule = {
        owner_user_id: user.id,
        workspace_id: workspace.workspace_id,
        title: "Daily opening announcement",
        daily_time: dailyTime,
        timezone,
        template_name: templateName,
        language_code: languageCode,
        body_parameters: bodyParameters,
        header_image_url: headerImageUrl || null,
        enabled: true,
        updated_at: new Date().toISOString(),
      };
      const result = existing?.id
        ? await admin.from("washdesk_whatsapp_schedules").update(schedule).eq("id", existing.id).select("id").single()
        : await admin.from("washdesk_whatsapp_schedules").insert(schedule).select("id").single();
      if (result.error) throw result.error;
      await kickDispatcher();
      return json({ saved: true, scheduleId: result.data.id, message: `Daily opening announcement scheduled for ${dailyTime} (${timezone}).` });
    }

    if (action === "disable-opening") {
      const { error } = await admin.from("washdesk_whatsapp_schedules").update({ enabled: false, updated_at: new Date().toISOString() })
        .eq("owner_user_id", user.id).eq("title", "Daily opening announcement");
      if (error) throw error;
      return json({ saved: true, enabled: false });
    }

    return bad("Unsupported WhatsApp action.");
  } catch (error) {
    console.error("WhatsApp API action failed:", error);
    return bad(error instanceof Error ? error.message : "WhatsApp API request failed.", 400);
  }
});

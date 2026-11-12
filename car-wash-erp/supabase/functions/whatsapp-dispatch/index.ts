import {
  decryptToken, getTemplate, graphRequest, normalizePhone, sendTemplateMessage,
  serviceClient,
} from "../_shared/whatsapp.ts";

const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
async function enqueueDueOpeningSchedules(admin: ReturnType<typeof serviceClient>) {
  const { data: schedules, error } = await admin.rpc("washdesk_whatsapp_claim_due_schedules");
  if (error) throw error;
  let queued = 0;
  for (const schedule of (schedules || [])) {
    try {
      const { data: sync, error: syncError } = await admin.from("washdesk_sync").select("payload")
        .eq("user_id", schedule.owner_user_id).maybeSingle();
      if (syncError) throw syncError;
      const customers = Array.isArray(sync?.payload?.customers) ? sync.payload.customers : [];
      const recipients = customers.filter((c: any) => c?.waOptIn === true && normalizePhone(c.phone).length >= 11);
      const jobs = recipients.map((c: any) => ({
        owner_user_id: schedule.owner_user_id,
        workspace_id: schedule.workspace_id,
        customer_id: String(c.id),
        recipient_name: String(c.name || "Customer"),
        to_phone: normalizePhone(c.phone),
        source_type: "opening_announcement",
        source_id: String(schedule.id),
        template_name: schedule.template_name,
        language_code: schedule.language_code,
        body_parameters: schedule.body_parameters || [],
        header_image_url: schedule.header_image_url || null,
        status: "queued",
        idempotency_key: `opening:${schedule.id}:${schedule.last_enqueued_local_date}:${c.id}`,
        scheduled_at: new Date().toISOString(),
      }));
      if (jobs.length) {
        const { error: insertError } = await admin.from("washdesk_whatsapp_jobs")
          .upsert(jobs, { onConflict: "idempotency_key", ignoreDuplicates: true });
        if (insertError) throw insertError;
        queued += jobs.length;
      }
    } catch (error) {
      console.error("Daily WhatsApp opening schedule failed:", schedule.id, error);
      await admin.from("washdesk_whatsapp_webhook_events").insert({
        owner_user_id: schedule.owner_user_id,
        event_type: "opening_schedule_error",
        payload: { scheduleId: schedule.id, message: String(error) },
      });
    }
  }
  return queued;
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const authorization = req.headers.get("Authorization") || "";
  if (!serviceKey || authorization !== `Bearer ${serviceKey}`) return json({ error: "Service authorization required" }, 401);

  const admin = serviceClient();
  try {
    const scheduled = await enqueueDueOpeningSchedules(admin);
    const { data: jobs, error } = await admin.rpc("washdesk_whatsapp_claim_jobs", { p_limit: 25 });
    if (error) throw error;
    const tokenCache = new Map<string, { token: string; connection: any }>();
    const templateCache = new Map<string, any>();
    let sent = 0, failed = 0, retried = 0;

    for (const job of (jobs || [])) {
      try {
        let auth = tokenCache.get(job.owner_user_id);
        if (!auth) {
          const { data: connection, error: connectionError } = await admin.from("washdesk_whatsapp_connections")
            .select("*").eq("owner_user_id", job.owner_user_id).maybeSingle();
          if (connectionError || !connection) throw new Error("WhatsApp API connection is missing.");
          if (connection.is_on_biz_app !== true) throw new Error("WhatsApp Business App Coexistence is no longer confirmed.");
          const token = await decryptToken(connection.access_token_ciphertext, connection.access_token_iv);
          auth = { token, connection };
          tokenCache.set(job.owner_user_id, auth);
        }
        const key = `${auth.connection.waba_id}:${job.template_name}:${job.language_code}`;
        let template = templateCache.get(key);
        if (!template) {
          template = await getTemplate(auth.token, auth.connection.waba_id, job.template_name, job.language_code);
          templateCache.set(key, template);
        }
        const result = await sendTemplateMessage(auth.token, auth.connection.phone_number_id, job, template);
        const messageId = result?.messages?.[0]?.id || null;
        const { error: updateError } = await admin.from("washdesk_whatsapp_jobs").update({
          status: "sent",
          meta_message_id: messageId,
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_error: null,
        }).eq("id", job.id);
        if (updateError) throw updateError;
        sent++;
      } catch (error) {
        const transient = Boolean((error as any)?.transient);
        const canRetry = transient && Number(job.attempts || 0) < 6;
        const delayMinutes = Math.min(60, Math.max(1, 2 ** Math.max(0, Number(job.attempts || 1) - 1)));
        const next = canRetry ? {
          status: "queued",
          scheduled_at: new Date(Date.now() + delayMinutes * 60_000).toISOString(),
        } : { status: "failed" };
        await admin.from("washdesk_whatsapp_jobs").update({
          ...next,
          last_error: String((error as Error)?.message || error).slice(0, 1500),
          updated_at: new Date().toISOString(),
        }).eq("id", job.id);
        if (canRetry) retried++; else failed++;
      }
    }
    return json({ scheduledJobsQueued: scheduled, jobsClaimed: jobs?.length || 0, sent, failed, retried });
  } catch (error) {
    console.error("WhatsApp dispatch failed:", error);
    return json({ error: error instanceof Error ? error.message : "WhatsApp dispatcher failed." }, 500);
  }
});

import { serviceClient } from "../_shared/whatsapp.ts";

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") || "";
const encoder = new TextEncoder();

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
function toHex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function verifySignature(rawBody: string, header: string | null) {
  if (!APP_SECRET || !header?.startsWith("sha256=")) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(APP_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expected = "sha256=" + toHex(new Uint8Array(digest));
  if (expected.length !== header.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return mismatch === 0;
}
Deno.serve(async (req) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && VERIFY_TOKEN && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  const valid = await verifySignature(raw, req.headers.get("x-hub-signature-256"));
  if (!valid) return new Response("Invalid signature", { status: 401 });

  try {
    const event = JSON.parse(raw);
    const admin = serviceClient();
    for (const entry of (event.entry || [])) {
      for (const change of (entry.changes || [])) {
        const value = change.value || {};
        const phoneNumberId = String(value.metadata?.phone_number_id || "");
        if (!phoneNumberId) continue;
        const { data: connection } = await admin.from("washdesk_whatsapp_connections")
          .select("owner_user_id").eq("phone_number_id", phoneNumberId).maybeSingle();
        const ownerId = connection?.owner_user_id || null;

        for (const status of (value.statuses || [])) {
          const messageId = String(status.id || "");
          const nextStatus = String(status.status || "");
          if (messageId && ["sent", "delivered", "read", "failed"].includes(nextStatus)) {
            const patch: Record<string, unknown> = {
              status: nextStatus,
              updated_at: new Date().toISOString(),
            };
            if (nextStatus === "delivered") patch.delivered_at = new Date().toISOString();
            if (nextStatus === "read") {
              patch.read_at = new Date().toISOString();
              patch.delivered_at = new Date().toISOString();
            }
            if (nextStatus === "failed") patch.last_error = JSON.stringify(status.errors || []).slice(0, 1500);
            await admin.from("washdesk_whatsapp_jobs").update(patch).eq("meta_message_id", messageId);
          }
          await admin.from("washdesk_whatsapp_webhook_events").insert({
            owner_user_id: ownerId,
            phone_number_id: phoneNumberId,
            meta_message_id: messageId || null,
            event_type: "message_status_" + (nextStatus || "unknown"),
            payload: status,
          });
        }
        for (const message of (value.messages || [])) {
          await admin.from("washdesk_whatsapp_webhook_events").insert({
            owner_user_id: ownerId,
            phone_number_id: phoneNumberId,
            meta_message_id: String(message.id || "") || null,
            event_type: "inbound_message",
            payload: message,
          });
        }
      }
    }
    return json({ received: true });
  } catch (error) {
    console.error("WhatsApp webhook event processing failed:", error);
    // Acknowledge only verified payloads; log processing failures for review.
    return json({ received: true, warning: "A verified webhook payload could not be fully processed." });
  }
});

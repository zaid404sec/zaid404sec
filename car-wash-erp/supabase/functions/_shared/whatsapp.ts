import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
export function bad(message: string, status = 400) {
  return json({ error: message }, status);
}
export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase service environment is not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function requireWorkspace(req: Request, ownerOnly = true) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("Sign in to Prime Auto Care before connecting WhatsApp.");
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anon) throw new Error("Supabase public environment is not configured.");
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) throw new Error("Your device session is invalid. Reconnect this device to the Prime Auto Care workspace.");
  const { data, error } = await userClient.rpc("washdesk_get_workspace");
  if (error) throw new Error("The Prime Auto Care shared workspace could not be verified.");
  const workspace = Array.isArray(data) ? data[0] : data;
  if (!workspace?.workspace_id || !workspace?.owner_user_id) throw new Error("This device is not paired with the Prime Auto Care shared workspace.");
  if (ownerOnly && (workspace.role !== "owner" || workspace.owner_user_id !== userData.user.id)) {
    throw new Error("Only the Prime Auto Care workspace owner can connect or manage WhatsApp automation.");
  }
  return { user: userData.user, workspace, userClient, admin: serviceClient() };
}

export function normalizePhone(value: unknown) {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10) digits = "91" + digits;
  return digits;
}
function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary);
}
function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
async function encryptionKey() {
  const secret = Deno.env.get("WHATSAPP_TOKEN_ENCRYPTION_KEY") || "";
  const bytes = new TextEncoder().encode(secret);
  if (bytes.length !== 32) throw new Error("Set WHATSAPP_TOKEN_ENCRYPTION_KEY to a random 32-character secret in Supabase Edge Function secrets.");
  return await crypto.subtle.importKey("raw", bytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptToken(token: string) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(token));
  return { ciphertext: bytesToBase64(new Uint8Array(data)), iv: bytesToBase64(iv) };
}
export async function decryptToken(ciphertext: string, ivText: string) {
  const key = await encryptionKey();
  const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(ivText) }, key, base64ToBytes(ciphertext));
  return new TextDecoder().decode(clear);
}
export function graphVersion() {
  return Deno.env.get("META_GRAPH_VERSION") || "v25.0";
}
export async function graphRequest(token: string, path: string, init: RequestInit = {}) {
  const url = path.startsWith("https://") ? path : `https://graph.facebook.com/${graphVersion()}/${path.replace(/^\//, "")}`;
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const message = payload?.error?.message || `WhatsApp Graph API request failed (${response.status}).`;
    const error = new Error(message);
    (error as Error & { graphStatus?: number; graphCode?: number; transient?: boolean }).graphStatus = response.status;
    (error as Error & { graphCode?: number }).graphCode = payload?.error?.code;
    (error as Error & { transient?: boolean }).transient = Boolean(payload?.error?.is_transient) || response.status >= 500 || response.status === 429;
    throw error;
  }
  return payload;
}
export async function getConnection(admin: ReturnType<typeof serviceClient>, ownerUserId: string) {
  const { data, error } = await admin.from("washdesk_whatsapp_connections").select("*").eq("owner_user_id", ownerUserId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("WhatsApp Business Platform is not connected. Complete Meta coexistence onboarding first.");
  return data;
}
export async function getTemplate(token: string, wabaId: string, name: string, language: string) {
  const response = await graphRequest(token, `/${wabaId}/message_templates?fields=id,name,status,category,language,components&limit=100`);
  const rows = Array.isArray(response?.data) ? response.data : [];
  const template = rows.find((t: any) => t.name === name && t.language === language && t.status === "APPROVED");
  if (!template) throw new Error(`Approved WhatsApp template "${name}" (${language}) was not found. Create and approve it in WhatsApp Manager first.`);
  return template;
}
export function makeTemplateComponents(template: any, bodyParameters: unknown[], recipientName: string, imageUrl?: string, documentUrl?: string, documentName?: string) {
  const components: any[] = [];
  const header = (template.components || []).find((c: any) => c.type === "HEADER");
  if (header?.format === "IMAGE") {
    if (!imageUrl) throw new Error("This approved template requires an image header URL.");
    if (!imageUrl.startsWith("https://")) throw new Error("WhatsApp template image URLs must use HTTPS.");
    components.push({ type: "header", parameters: [{ type: "image", image: { link: imageUrl } }] });
  } else if (header?.format === "DOCUMENT") {
    if (!documentUrl) throw new Error("This invoice template requires a PDF document header.");
    if (!documentUrl.startsWith("https://")) throw new Error("WhatsApp document URLs must use HTTPS.");
    components.push({ type: "header", parameters: [{ type: "document", document: { link: documentUrl, filename: documentName || "Prime-Auto-Care-Invoice.pdf" } }] });
  }
  const body = (template.components || []).find((c: any) => c.type === "BODY");
  const source = Array.isArray(bodyParameters) ? bodyParameters : [];
  const placeholderCount = [...String(body?.text || "").matchAll(/\{\{\s*\d+\s*\}\}/g)].length;
  if (placeholderCount !== source.length) {
    throw new Error(`Template "${template.name}" requires ${placeholderCount} body variable(s), but ${source.length} were supplied.`);
  }
  if (source.length) {
    const parameters = source.map((value) => {
      let text = String(value ?? "");
      text = text.replace(/\{\{\s*name\s*\}\}/gi, recipientName || "Customer");
      return { type: "text", text: text.slice(0, 1024) };
    });
    components.push({ type: "body", parameters });
  }
  return components;
}
export async function sendTemplateMessage(token: string, phoneNumberId: string, job: any, template: any, documentUrl?: string) {
  const components = makeTemplateComponents(
    template,
    Array.isArray(job.body_parameters) ? job.body_parameters : [],
    job.recipient_name || "",
    job.header_image_url || undefined,
    documentUrl || job.header_document_url || undefined,
    job.header_document_name || undefined,
  );
  return await graphRequest(token, `/${phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: job.to_phone,
      type: "template",
      template: { name: job.template_name, language: { code: job.language_code }, components },
    }),
  });
}

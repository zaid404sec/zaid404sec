import { bad, corsHeaders, encryptToken, graphRequest, json, normalizePhone, requireWorkspace } from "../_shared/whatsapp.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return bad("Use POST for WhatsApp connection.", 405);
  try {
    const { user, workspace, admin } = await requireWorkspace(req, true);
    const body = await req.json();
    const action = String(body?.action || "connect");

    if (action === "status") {
      const { data, error } = await admin.from("washdesk_whatsapp_connections")
        .select("waba_id,phone_number_id,display_phone_number,verified_name,is_on_biz_app,connected_at")
        .eq("owner_user_id", user.id).maybeSingle();
      if (error) throw error;
      return json({ connected: Boolean(data), connection: data || null });
    }

    if (action === "disconnect") {
      const { error } = await admin.from("washdesk_whatsapp_connections").delete().eq("owner_user_id", user.id);
      if (error) throw error;
      return json({ connected: false, message: "The API credential was removed. The WhatsApp Business app account was not deregistered." });
    }

    if (action !== "connect") return bad("Unsupported WhatsApp connection action.");

    const accessToken = String(body?.accessToken || "").trim();
    const phoneNumberId = String(body?.phoneNumberId || "").trim();
    const wabaId = String(body?.wabaId || "").trim();
    const expectedPhone = normalizePhone(body?.expectedPhone);
    if (!accessToken || !phoneNumberId || !wabaId || !expectedPhone) {
      return bad("Enter the system-user access token, WABA ID, Phone Number ID and the business phone number.");
    }
    if (accessToken.length < 40 || accessToken.length > 4096) return bad("The Meta access token does not look valid.");

    // Read the number's platform state before saving any credential. The Business
    // app must remain active through Meta's Coexistence onboarding.
    const phone = await graphRequest(accessToken, `/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number,verified_name,is_on_biz_app,platform_type`);
    const displayPhone = String(phone?.display_phone_number || "");
    if (String(phone?.id || "") !== phoneNumberId) return bad("Meta returned a different Phone Number ID.");
    if (normalizePhone(displayPhone) !== expectedPhone) return bad("The Meta Phone Number ID does not belong to the business number entered here.");
    if (phone?.is_on_biz_app !== true) {
      return bad("Meta has not confirmed WhatsApp Business App Coexistence for this number. Stop here: do not deregister the number or use standard phone registration. Complete Meta's 'connect your existing WhatsApp Business app' / Coexistence onboarding first, then retry.");
    }
    if (String(phone?.platform_type || "").toUpperCase() !== "CLOUD_API") {
      return bad("Meta does not report this phone as connected to Cloud API. Complete the official Coexistence onboarding before connecting Prime Auto Care.");
    }

    const list = await graphRequest(accessToken, `/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name&limit=100`);
    const numbers = Array.isArray(list?.data) ? list.data : [];
    if (!numbers.some((n: any) => String(n.id) === phoneNumberId)) {
      return bad("The Phone Number ID is not listed under the supplied WhatsApp Business Account ID.");
    }

    // Subscribe the Meta app to the WABA so inbound delivery and status events
    // reach the verified webhook configured in Meta Developers.
    await graphRequest(accessToken, `/${encodeURIComponent(wabaId)}/subscribed_apps`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    const encrypted = await encryptToken(accessToken);
    const { error } = await admin.from("washdesk_whatsapp_connections").upsert({
      owner_user_id: user.id,
      workspace_id: workspace.workspace_id,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      display_phone_number: displayPhone,
      verified_name: phone?.verified_name || null,
      is_on_biz_app: true,
      access_token_ciphertext: encrypted.ciphertext,
      access_token_iv: encrypted.iv,
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_user_id" });
    if (error) throw error;

    return json({
      connected: true,
      connection: {
        wabaId,
        phoneNumberId,
        displayPhoneNumber: displayPhone,
        verifiedName: phone?.verified_name || "",
        isOnBizApp: true,
      },
      message: "WhatsApp Business Platform connection saved. Your existing Business app remains connected. Only approved templates can be used for business-initiated messages.",
    });
  } catch (error) {
    console.error("WhatsApp connection error:", error);
    return bad(error instanceof Error ? error.message : "WhatsApp connection failed.", 400);
  }
});

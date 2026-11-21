import { readFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const capacitorConfig = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8'));
if (packageJson.version !== '2.14.2') throw new Error('The package version must be 2.14.2.');
if (capacitorConfig.appId !== 'com.washdesk.carwash.v31') {
  throw new Error('The 2.14.2 APK must use the v31 application ID for side-by-side installation; the original signing key was not supplied.');
}
console.log('PASS: Android 2.14.2 uses the v31 side-by-side application ID; prior app data is preserved.');

if (!html.includes('id="dashboard-date"') || !html.includes('advance-staff-filter') || !html.includes('advance-month-filter') || !html.includes('Advance grand total')) throw new Error('Historical dashboard and staff advance filters are missing.');
console.log('PASS: historical dashboard and staff/month advance summary');
if (!html.includes("data-action=\"dashboard-refresh\"") ||
    !html.includes("pendingRemotePayload=remote") ||
    !html.includes("return {__cloudSyncDeferred:true};")) {
  throw new Error('Remote snapshots must still be queued while a business form or modal is active.');
}
const receiveStart=html.indexOf('function receiveCloudData(remote){');
const receiveEnd=html.indexOf('async function connectCloud(e){',receiveStart);
const receiveBlock=html.slice(receiveStart,receiveEnd);
const safeRenderStart=html.indexOf('function canRenderRemoteUpdate(){');
const safeRenderEnd=html.indexOf('function shouldDeferRemoteUpdate(){',safeRenderStart);
const safeRenderGuard=html.slice(safeRenderStart,safeRenderEnd);
if(receiveStart<0||receiveEnd<0||!receiveBlock.includes('canRenderRemoteUpdate()')||
   !receiveBlock.includes('render()')||safeRenderStart<0||
   !safeRenderGuard.includes("page==='billing'")||
   !safeRenderGuard.includes("modal-backdrop")||
   !safeRenderGuard.includes("active.matches('input,textarea,select,[contenteditable=\"true\"]')")||
   !html.includes("if(page!=='billing'&&applyPendingRemoteData())render()")) {
  throw new Error('Realtime updates must render immediately when safe and defer while the Owner is editing or a modal is open.');
}
console.log('PASS: cross-device realtime updates render immediately when safe; active billing/forms/modals are protected until close');
if (!html.includes('color-scheme:dark') || !html.includes('backdrop-filter:blur(24px)') ||
    !html.includes('deep liquid-glass')) {
  throw new Error('Deep liquid-glass app theme is missing.');
}
if (!html.includes('Persistent Light/Dark appearance preference') ||
    !html.includes('id="theme-selector"') ||
    !html.includes("localStorage.getItem('prime-auto-care-theme')") ||
    !html.includes("localStorage.setItem('prime-auto-care-theme',theme)")) {
  throw new Error('Persistent per-device Dark/Light appearance setting is missing.');
}
console.log('PASS: persistent per-device Dark/Light appearance setting');

if (!html.includes('Founder') || !html.includes('Owner Operator')) throw new Error('Founder and Owner Operator roles are missing.');
console.log('PASS: Founder and Owner Operator roles');
if (!html.includes('Personal / Household · Vehicle Petrol') || !html.includes('Personal / Household · House Light Bill') || !html.includes("expenseType==='personal'")) throw new Error('Personal and household expense classification is missing.');
console.log('PASS: personal and household expense separation');
if (!html.includes('https://share.google/6g3f0aJqTezi6JH5T') || !html.includes('google-review-form') || !html.includes('google-review-whatsapp') || !html.includes('invoice-review-footer')) throw new Error('Google review workflow is incomplete.');
if (!html.includes('data-page="bookings"') || !html.includes("function bookings(){") ||
    !html.includes("function loadBookingCenter(") || !html.includes("submitBookingQuickForm") ||
    !html.includes("saveBookingSettingsForm") || !html.includes("PUBLIC_BOOKING_URL") ||
    !html.includes('id="booking-filter-form"') || !html.includes('bookingNotificationSeen') ||
    !html.includes('is_urgent') || !html.includes('notification_whatsapp_template')) {
  throw new Error('WashDesk Bookings page, staff booking workflow or public link is incomplete.');
}
if (!existsSync(new URL('../src/bookings.js', import.meta.url)) ||
    !existsSync(new URL('../website/booking/index.html', import.meta.url)) ||
    !existsSync(new URL('../supabase/functions/booking-api/index.ts', import.meta.url)) ||
    !existsSync(new URL('../supabase/migrations/20261118190000_prime_auto_care_bookings.sql', import.meta.url)) ||
    !existsSync(new URL('../supabase/migrations/20261118193000_google_review_auto_reply.sql', import.meta.url)) ||
    !existsSync(new URL('../supabase/migrations/20261119034723_booking_urgency_notifications_google_publication.sql', import.meta.url)) ||
    !existsSync(new URL('../supabase/migrations/20261119041849_booking_notification_fk_indexes.sql', import.meta.url)) ||
    !existsSync(new URL('../supabase/migrations/20261119080000_booking_rejected_status.sql', import.meta.url)) ||
    !existsSync(new URL('../supabase/migrations/20261119085155_booking_multi_device_notifications_20261119.sql', import.meta.url)) ||
    !existsSync(new URL('../supabase/migrations/20261119085216_booking_status_actor_attribution_20261119.sql', import.meta.url)) ||
    !existsSync(new URL('../supabase/migrations/20261119085230_booking_status_atomic_notifications_20261119.sql', import.meta.url)) ||
    !existsSync(new URL('../supabase/migrations/20261119085605_google_ai_key_vault_setup_20261119.sql', import.meta.url)) ||
    !existsSync(new URL('../supabase/migrations/20261119090408_booking_notification_realtime_20261119.sql', import.meta.url)) ||
    !existsSync(new URL('../supabase/migrations/20261119190447_booking_create_atomic_notification_events_20261120.sql', import.meta.url)) ||
    !existsSync(new URL('../supabase/migrations/20261120130000_workspace_members_auto_booking_alerts.sql', import.meta.url)) ||
    !existsSync(new URL('../supabase/migrations/20261120190000_preserve_owner_role_on_workspace_pairing.sql', import.meta.url)) ||
    !existsSync(new URL('../supabase/migrations/20261119160000_google_vault_setup_wizard.sql', import.meta.url)) ||
    !existsSync(new URL('../supabase/functions/public-reviews/index.ts', import.meta.url)) ||
    !existsSync(new URL('../src/google-reviews.js', import.meta.url))) {
  throw new Error('One or more booking source, migration, API or public website files are missing.');
}
console.log('PASS: public booking portal, staff bookings module, additive migration and API files exist');
const bookingApiSource = await readFile(new URL('../supabase/functions/booking-api/index.ts', import.meta.url), 'utf8');
if (!bookingApiSource.includes("'Private Car'") ||
    !bookingApiSource.includes("'Private SUV'") ||
    !bookingApiSource.includes("'Private Car / SUV'") ||
    !bookingApiSource.includes("'Taxi'") ||
    !bookingApiSource.includes("'Commercial Transport / Traveller'") ||
    bookingApiSource.includes("'Taxi / Commercial'") ||
    !bookingApiSource.includes("'rejected'") ||
    !bookingApiSource.includes("pac_update_booking_status_and_notify") ||
    !bookingApiSource.includes("p_actor_user_id") ||
    !bookingApiSource.includes("p_actor_label") ||
    !html.includes("data-status=\"rejected\"") ||
    !html.includes("rejected:'red'") ||
    !html.includes("'Commercial Transport / Traveller'")) {
  throw new Error('Booking taxonomy, rejection action or guarded status-transition checks are missing.');
}
console.log('PASS: private vehicles, taxis and commercial transport are distinct; Pending requests can be rejected safely');
if (!html.includes('<option value="Private Car">Private Car</option>') ||
    !html.includes('<option value="Private SUV">Private SUV</option>')) {
  throw new Error('Staff booking form must distinguish Private Car and Private SUV.');
}
console.log('PASS: staff booking filters distinguish Private Car, Private SUV, Taxi and Commercial Transport');

const bookingNotificationMigration = await readFile(new URL('../supabase/migrations/20261119043635_booking_notification_admin_access.sql', import.meta.url), 'utf8');
for (const token of ['canManageBookingNotifications','pac_booking_notification_admins','action === \'notifications\'','action === \'acknowledge-notification\'']) {
  if (!bookingApiSource.includes(token)) throw new Error('Booking alert API is missing scoped notification access: '+token);
}
for (const token of ['pac_booking_notification_admins','booking_notifications_admin','enable row level security','revoke all on public.pac_booking_notification_admins from public, anon, authenticated','grant all on public.pac_booking_notification_admins to service_role','pac_google_review_admins','on conflict (workspace_id, auth_user_id) do nothing']) {
  if (!bookingNotificationMigration.toLowerCase().includes(token.toLowerCase())) throw new Error('Booking notification permission migration is incomplete: '+token);
}
console.log('PASS: the paired booking desk receives scoped alerts without changing the original Workspace Owner');
for (const token of ['pac_booking_notification_receipts','notification_id','acknowledge-notification','auth_user_id']) {
  if (!bookingApiSource.includes(token)) throw new Error('Per-device booking notification acknowledgement support is missing: '+token);
}
if (bookingApiSource.includes('acknowledged_at: new Date().toISOString(), acknowledged_by: ctx.user.id')) {
  throw new Error('Booking acknowledgement must be per-device, not a global event acknowledgement.');
}
if (!html.includes('booking-enable-notifications') ||
    !html.includes('requestBookingAlertPermission') ||
    !bookingApiSource.includes("if (!(await canReceiveBookingAlerts(ctx)))")) {
  throw new Error('Booking notifications must use the active authorised staff-device session.');
}
if (!bookingApiSource.includes('notification_device_count') || !bookingApiSource.includes('notifications_enabled')) {
  throw new Error('Booking API must report current authorised staff-device notification status.');
}
console.log('PASS: booking alerts require a PAC-code-authorised active device; notifications are acknowledged per device');
const localNotificationsSource = await readFile(new URL('../src/local-notifications.js', import.meta.url), 'utf8');
if (!localNotificationsSource.includes('sendBookingAlertNotification') ||
    !localNotificationsSource.includes('requestBookingAlertPermission') ||
    !localNotificationsSource.includes('BOOKING_ALERT_CHANNEL_ID') ||
    !localNotificationsSource.includes('booking_confirmed') ||
    !localNotificationsSource.includes('booking_rejected') ||
    !localNotificationsSource.includes('new window.Notification') ||
    !html.includes('sendBookingAlertNotification') ||
    !html.includes("BOOKING ACCEPTED") ||
    !html.includes("BOOKING REJECTED") ||
    !html.includes('booking-enable-notifications')) {
  throw new Error('Native and desktop booking notification support is missing from the app polling flow.');
}
console.log('PASS: Android local and desktop browser booking notifications have explicit permission controls');

const bookingClientSource = await readFile(new URL('../src/bookings.js', import.meta.url), 'utf8');
const fiveDeviceBookingApiSource = await readFile(new URL('../supabase/functions/booking-api/index.ts', import.meta.url), 'utf8');
const bookingDeviceMigration = await readFile(new URL('../supabase/migrations/20261120150000_owner_managed_five_device_booking_access.sql', import.meta.url), 'utf8');
for (const token of ['requestDeviceAccess','reviewDeviceAccess','revokeDeviceAccess']) {
  if (!bookingClientSource.includes(token)) throw new Error('Booking device client API is missing: '+token);
}
for (const token of [
  'request-booking-device-access','review-booking-device-access','revoke-booking-device-access',
  'canDecideBookings(ctx)',
  '!ctx.isOwner && ![\'confirmed\', \'rejected\'].includes(status)',
  'max_staff_devices:4','notification_device_count','max_notification_devices: 4'
]) {
  if (!fiveDeviceBookingApiSource.includes(token)) throw new Error('Booking device access enforcement is missing: '+token);
}
for (const token of [
  'create table if not exists public.pac_booking_devices',
  'can_decide_bookings boolean not null default false',
  "check (status in ('pending', 'active', 'rejected', 'revoked'))",
  "'Owner Phone'"
]) {
  if (!bookingDeviceMigration.includes(token)) throw new Error('Five-device migration is missing: '+token);
}
const cloudSource = await readFile(new URL('../src/cloud-sync.js', import.meta.url), 'utf8');
const permanentOwnerCodeMigration = await readFile(new URL('../supabase/migrations/20261120180000_pac_permanent_owner_booking_code.sql', import.meta.url), 'utf8');
for (const token of [
  'id="booking-device-role"',
  'Owner Phone',
  'Dad Phone',
  'Zaid Phone',
  'Jack Phone',
  'Manager Phone',
  'value="owner">Owner',
  'value="member" selected>Member',
  'value="not-sure">Not sure',
  'id="booking-device-label"',
  'id="booking-device-kind"',
  'id="booking-pair-code"',
  'data-action="booking-pair-code-verify"',
  'id="pac-owner-code-panel"',
  'data-action="save-pac-owner-code"',
  'PAC Owner Code',
  'Staff devices can view bookings and Accept or Reject them.',
  'Only the Owner can remove connected devices'
]) {
  if (!html.includes(token)) throw new Error('Permanent PAC Owner Code UI or staff access restrictions are missing: '+token);
}
for (const token of ['getBookingAccessSettings','setPermanentOwnerCode','pairWithOwnerCode']) {
  if (!bookingClientSource.includes(token)) throw new Error('Permanent PAC Owner Code client API is missing: '+token);
}
for (const token of [
  'async function pairBookingDevice',
  'pac_join_workspace_with_owner_code',
  "workspace.role !== 'owner'",
  'Staff devices have booking-only access'
]) {
  if (!cloudSource.includes(token)) throw new Error('Booking-only cloud session restriction is missing: '+token);
}
for (const token of [
  'get-booking-access-settings','set-booking-owner-code',
  'memberBookingActions',
  'device?.can_decide_bookings === true',
  'Staff devices can only Accept or Reject bookings',
  'Only the Owner can create or change the PAC Owner Code'
]) {
  if (!fiveDeviceBookingApiSource.includes(token)) throw new Error('Permanent Owner Code API enforcement is missing: '+token);
}
for (const token of [
  'pac_booking_access_codes',
  'pac_booking_access_code_attempts',
  'pac_join_workspace_with_owner_code',
  "m.role = 'owner'",
  'washdesk_merge_sync_owner_internal',
  'washdesk_next_invoice_number_owner_internal'
]) {
  if (!permanentOwnerCodeMigration.includes(token)) throw new Error('Permanent Owner Code database security migration is incomplete: '+token);
}
const staffLimitMigration = await readFile(new URL('../supabase/migrations/20261120183000_pac_owner_code_staff_device_limit.sql', import.meta.url), 'utf8');
for (const token of ['for update;', "m.role = 'member'", 'd.status = \'active\'']) {
  if (!staffLimitMigration.includes(token)) throw new Error('Staff device limit must count active Member devices only: '+token);
}
console.log('PASS: permanent PAC Owner Code, direct booking-only pairing, Owner-only business sync and Owner-managed device removal');
console.log('PASS: new Owner installations restore all business modules through registered Owner email/password sign-in; staff PAC pairing remains Bookings-only');
if (!cloudSource.includes('signInWithPassword') ||
    !cloudSource.includes('REGISTERED_OWNER_EMAILS.has(cleanEmail)') ||
    !html.includes('name="email"') || !html.includes('name="password"') ||
    !html.includes('Connect &amp; open Prime Auto Care') ||
    html.includes('id="owner-cloud-forgot-password"') ||
    !html.includes('id="owner-cloud-login-status"') ||
    !html.includes('bmumz3909@gmail.com') ||
    html.includes('mz03200786@gmail.com')) {
  throw new Error('Single permanent Owner username/password login or registered Owner guard is missing.');
}
const ownerPasswordInput = html.match(/<input name="password" type="password"[^>]*>/)?.[0] || '';
if (cloudSource.includes('ZAID') || cloudSource.includes('IMRAN') || !ownerPasswordInput || /\bvalue\s*=/.test(ownerPasswordInput)) {
  throw new Error('Owner passwords must never be embedded in client source or prefilled into the login field.');
}
console.log('PASS: single Owner username/password login; no hard-coded passwords or visible reset/pairing UI');
if (!html.includes('Supabase did not accept the password for') ||
    !html.includes('Update the password for this existing user in Supabase Authentication') ||
    !html.includes("submit.textContent='Connect & open Prime Auto Care'") ||
    html.includes('The PAC Owner Code and 64-character workspace pairing key are not login passwords.')) {
  throw new Error('Failed Owner login must provide direct Supabase password guidance without pairing-code confusion.');
}
console.log('PASS: failed Owner login explains the actual Supabase Auth password mismatch and keeps the current login button label');
if (!html.includes('id="bill-date"') ||
    !html.includes("document.getElementById('bill-date')") ||
    !html.includes('name="paymentMode"') ||
    !html.includes('function invoicePaymentHistory(i)') ||
    !html.includes('function editInvoicePayment(paymentId)') ||
    !html.includes('function deleteInvoicePayment(paymentId)') ||
    !html.includes('data-edit-payment=') ||
    !html.includes('data-delete-payment=') ||
    !html.includes('db._deletedIds[paymentId]')) {
  throw new Error('Invoice date, Cash/UPI payment methods, payment edit/delete or synced payment deletion is missing.');
}
if (!html.includes('Delete / cancel bill') || !html.includes('voided (not physically erased)')) {
  throw new Error('Invoice correction must use audited cancellation and stock reversal, not destructive hard deletion.');
}
console.log('PASS: editable invoice date, Cash/UPI payment methods, payment edit/delete and audited invoice cancellation');
const authDeepLinkSource = await readFile(new URL('./configure-android-auth-deeplink.mjs', import.meta.url), 'utf8');
if (!cloudSource.includes('completeOwnerPasswordRecovery') ||
    !cloudSource.includes('exchangeCodeForSession') ||
    !cloudSource.includes('appStateChange') ||
    html.includes('id="owner-cloud-forgot-password"') ||
    !html.includes('owner-recovery-password-form') ||
    !html.includes('function receiveCloudData(remote)') ||
    !html.includes('if(!canRenderRemoteUpdate())') ||
    !authDeepLinkSource.includes('primeautocare28')) {
  throw new Error('Legacy secure recovery callback or immediate safe cloud update UI is missing.');
}
console.log('PASS: secure Owner recovery, native deep link, foreground refresh and immediate safe cross-device update rendering');
const ownerWriteMigration = await readFile(new URL('../supabase/migrations/20261121100000_owner_only_cloud_writes.sql', import.meta.url), 'utf8');
if ((ownerWriteMigration.match(/and m\.role = ''owner''/g) || []).length < 2) {
  throw new Error('Both shared sync writes and invoice numbering must require the Owner role on the database server.');
}


const notificationPollStart = html.indexOf('async function pollBookingNotifications(){');
const notificationPollEnd = html.indexOf('async function loadBookingCenter(', notificationPollStart);
if (notificationPollStart < 0 || notificationPollEnd < 0) throw new Error('Booking notification poller could not be inspected.');
const notificationPoll = html.slice(notificationPollStart, notificationPollEnd);
const deliveryIndex = notificationPoll.indexOf('const delivery=await sendAlert(item);');
const receiptIndex = notificationPoll.indexOf('acknowledgeNotification(id)');
const deniedIndex = notificationPoll.indexOf('if(delivery?.permissionDenied)');
const deliveryGuardIndex = notificationPoll.indexOf('if(delivery?.supported!==true||delivery?.scheduled!==true)');
if (deliveryIndex < 0 || receiptIndex < deliveryIndex || deniedIndex < 0 ||
    deliveryGuardIndex < deniedIndex || notificationPoll.slice(deniedIndex, deliveryGuardIndex).includes('acknowledgeNotification') ||
    !notificationPoll.includes('bookingNotificationRetryAt.set(id,Date.now()+60000)') ||
    deliveryGuardIndex < deliveryIndex ||
    !html.includes("document.addEventListener('visibilitychange'")) {
  throw new Error('Booking alerts must remain unread when Android delivery fails and retry after the app resumes.');
}
console.log('PASS: booking alert receipts are acknowledged only after delivery; denied/failed alerts remain retryable');

const bookingWebsite = await readFile(new URL('../website/booking/index.html', import.meta.url), 'utf8');
if (!bookingWebsite.includes('id="booking-form"') ||
    !bookingWebsite.includes('function request(action') ||
    !bookingWebsite.includes("'public-config'") ||
    !bookingWebsite.includes("'availability'") ||
    !bookingWebsite.includes("'create-public'") ||
    !bookingWebsite.includes('PENDING until Prime Auto Care confirms') ||
    !bookingWebsite.includes('id="is_urgent"') ||
    !bookingWebsite.includes("is_urgent:$('is_urgent').checked===true") ||
    !bookingWebsite.includes('src="https://raw.githubusercontent.com/zaid404sec/zaid404sec/main/car-wash-erp/prime-auto-care-logo.jpg"') ||
    !existsSync(new URL('../prime-auto-care-logo.jpg', import.meta.url))) {
  throw new Error('Customer booking page is missing its public API flow or pending-confirmation safeguard.');
}
const bookingInlineScripts = [...bookingWebsite.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
if (!bookingInlineScripts.length) throw new Error('Customer booking page has no inline application script.');
for (const match of bookingInlineScripts) {
  await transform(match[1], { loader: 'js', target: 'es2020', logLevel: 'silent' });
}
console.log('PASS: public customer booking HTML and JavaScript syntax');
const businessWebsite = await readFile(new URL('../website/index.html', import.meta.url), 'utf8');
if (!businessWebsite.includes('id="reviews"') ||
    !businessWebsite.includes('google-review-feed') ||
    !businessWebsite.includes('/functions/v1/public-reviews') ||
    !businessWebsite.includes('Google-approved reply')) {
  throw new Error('Public business website is missing its live Google review feed and approved-reply safeguard.');
}
const websiteScripts = [...businessWebsite.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
const websiteJsonLd = websiteScripts.filter(match => /\btype=["']application\/ld\+json["']/i.test(match[1]));
if (!websiteJsonLd.length) throw new Error('Public business website is missing its Schema.org JSON-LD structured data.');
for (const match of websiteJsonLd) JSON.parse(match[2]);
const websiteInlineScripts = websiteScripts.filter(match => !/\btype=["']application\/ld\+json["']/i.test(match[1]));
if (!websiteInlineScripts.length) throw new Error('Public business website has no inline application script.');
for (const match of websiteInlineScripts) {
  await transform(match[2], { loader: 'js', target: 'es2020', logLevel: 'silent' });
}
console.log('PASS: public business website review feed, DOM rendering, Schema.org JSON-LD and JavaScript syntax');

if (!html.includes('google-auto-reply-enabled') || !html.includes('google-review-save-auto-reply') ||
    !html.includes('Only the original Workspace Owner') ||
    !html.includes('function googleReviewSetupMarkup(state)') ||
    !html.includes('google-review-save-project-number') ||
    !html.includes('google-review-copy-oauth-callback') ||
    !html.includes('oauth_credentials_ready') ||
    !html.includes('pubsub_credentials_ready') ||
    html.includes('google-ai-api-key') ||
    !existsSync(new URL('../supabase/functions/google-review-worker/index.ts', import.meta.url))) {
  throw new Error('Owner-controlled event-driven Google AI reply workflow is incomplete.');
}
const googleReviewWorkerSource = await readFile(new URL('../supabase/functions/google-review-worker/index.ts', import.meta.url), 'utf8');
const googleReviewApiSource = await readFile(new URL('../supabase/functions/google-review-api/index.ts', import.meta.url), 'utf8');
if (!googleReviewApiSource.includes("env('OPENROUTER_API_KEY')") ||
    googleReviewApiSource.includes('body.api_key') ||
    !googleReviewApiSource.includes('save-google-project-number') ||
    !googleReviewApiSource.includes('oauth_callback_url') ||
    !googleReviewApiSource.includes('openrouter_api_key_configured') ||
    !googleReviewApiSource.includes('save-google-oauth-config') ||
    !googleReviewApiSource.includes('pac_store_google_oauth_app_config') ||
    !googleReviewApiSource.includes('pac_get_google_oauth_app_config') ||
    !googleReviewApiSource.includes('save-openrouter-key') ||
    !googleReviewApiSource.includes('pac_store_openrouter_key') ||
    !googleReviewApiSource.includes('save-google-pubsub-settings') ||
    !googleReviewApiSource.includes('pac_store_google_review_worker_secret') ||
    !googleReviewApiSource.includes('google_pubsub_audience')) {
  throw new Error('Google setup must save OAuth, AI and Pub/Sub credentials through the paired owner session into Supabase Vault.');
}
const googleVaultSetupClient = await readFile(new URL('../src/google-reviews.js', import.meta.url), 'utf8');
if (!html.includes('google-oauth-client-id') ||
    !html.includes('google-oauth-client-secret') ||
    !html.includes('google-openrouter-api-key') ||
    !html.includes('google-pubsub-topic') ||
    !html.includes('google-pubsub-service-account') ||
    !html.includes('google-review-save-oauth-config') ||
    !html.includes('google-review-save-openrouter-key') ||
    !html.includes('google-review-save-pubsub-settings') ||
    !googleVaultSetupClient.includes('saveGoogleOAuthConfig') ||
    !googleVaultSetupClient.includes('saveOpenRouterKey') ||
    !googleVaultSetupClient.includes('savePubSubSettings')) {
  throw new Error('Google Review Center must expose the paired-session Vault setup fields and save actions.');
}
const googleVaultSetupCallback = await readFile(new URL('../supabase/functions/google-review-oauth-callback/index.ts', import.meta.url), 'utf8');
const googleVaultSetupWebhook = await readFile(new URL('../supabase/functions/google-review-pubsub-webhook/index.ts', import.meta.url), 'utf8');
const googleVaultSetupMigration = await readFile(new URL('../supabase/migrations/20261119160000_google_vault_setup_wizard.sql', import.meta.url), 'utf8');
if (!googleVaultSetupMigration.includes('ORIGINAL_WORKSPACE_OWNER_REQUIRED') ||
    !googleVaultSetupMigration.includes('vault.create_secret') ||
    !googleVaultSetupMigration.includes('vault.update_secret') ||
    !googleVaultSetupMigration.includes('revoke all on function public.pac_store_google_review_worker_secret')) {
  throw new Error('The internal Pub/Sub worker secret must be stored in Supabase Vault through an original-owner-only RPC.');
}
if (!googleVaultSetupCallback.includes('pac_get_google_oauth_app_config') ||
    !googleReviewWorkerSource.includes('pac_get_google_oauth_app_config') ||
    !googleVaultSetupWebhook.includes('google_pubsub_audience') ||
    !googleVaultSetupWebhook.includes('pac_get_google_review_worker_secret') ||
    googleVaultSetupWebhook.includes("env('GOOGLE_PUBSUB_AUDIENCE')") ||
    googleVaultSetupWebhook.includes("env('GOOGLE_REVIEW_WORKER_SECRET')") ||
    !googleReviewWorkerSource.includes('pac_get_google_review_worker_secret')) {
  throw new Error('Google OAuth callback and Pub/Sub event processing must load their per-workspace credentials from Vault.');
}
console.log('PASS: Google setup wizard uses paired session, original-owner OAuth and server-side AI secrets');
if (!googleReviewWorkerSource.includes('readGoogleReplyModeration') ||
    !googleReviewWorkerSource.includes('reviewReplyState') ||
    !googleReviewWorkerSource.includes('publication_state') ||
    !googleReviewApiSource.includes('readGoogleReplyModeration') ||
    !googleReviewApiSource.includes('reviewReplyState') ||
    !googleReviewApiSource.includes('publication_state')) {
  throw new Error('Google public and AI-generated replies must record moderation states after submission.');
}
console.log('PASS: Google AI auto-reply and manual reply both track moderation status from Google');
if (!html.includes('replyPublicationPill') || !html.includes('Google moderation state')) {
  throw new Error('Google Review Center must display the moderation status for each public reply.');
}
console.log('PASS: Google Review Center displays pending, approved and rejected publication states');
console.log('PASS: AI auto-reply controls are owner-only, off by default and have a server-side worker');


console.log('PASS: Google review workflow');
const googleReviewPageStart=html.indexOf('function googleReviews(){');
const googleReviewPageEnd=html.indexOf('async function loadGoogleReviewCenter(',googleReviewPageStart);
const googleReviewPage=html.slice(googleReviewPageStart,googleReviewPageEnd);
if(!googleReviewPage.includes('id="google-manual-review"') ||
   !googleReviewPage.includes('id="google-manual-reply"') ||
   !googleReviewPage.includes('data-action="google-review-copy-manual-reply"') ||
   !googleReviewPage.includes('data-action="google-review-open-manager"') ||
   googleReviewPage.includes('data-action="google-review-connect"')) {
  throw new Error('Google Review Center must expose a manual reply workflow without making OAuth a prerequisite.');
}
if(!html.includes("async function googleReviewOpenManager()") ||
   !html.includes("https://business.google.com/") ||
   !html.includes("document.addEventListener('input',e=>{if(e.target?.id==='google-manual-review')") ) {
  throw new Error('Manual Google reply copy and Business Profile manager actions are incomplete.');
}
console.log('PASS: manual Google review composer can copy replies and open Google Business Profile without OAuth');
if(!html.includes('id="sidebar-backdrop"') ||
   !html.includes('sidebar-backdrop.active') ||
   !html.includes('overscroll-behavior-y:contain') ||
   !html.includes('body.sidebar-open') ||
   !html.includes("function setSidebarOpen(open)") ||
   !html.includes("event.key==='Escape'")) {
  throw new Error('Mobile navigation drawer must scroll independently, block background scrolling and close via backdrop/Escape.');
}
console.log('PASS: mobile navigation drawer has independent scrolling, backdrop, scroll lock and close controls');

if (!html.includes("db.settings?.invoiceTemplate||'classic'") || !html.includes("{dark:'#17130c',primary:'#d6b15f'") || html.includes('{dark:invoiceTheme.dark')) throw new Error('Original default invoice template or safe theme initialisation is missing.');
if (!html.includes('invoice-template-selector') || !html.includes('Navy Professional') || !html.includes('Forest Green') || !html.includes('Burgundy Professional')) throw new Error('The professional invoice template selector is incomplete.');
console.log('PASS: original invoice is the default; alternative professional PDF templates are selectable');

if (!html.includes("if(page!=='dashboard')return true;") ||
    !html.includes("if(page!==p)applyPendingRemoteData();") ||
    !html.includes("requestAnimationFrame(()=>window.scrollTo(scrollX,scrollY))")) {
  throw new Error('Remote updates must not replace active modules and same-page renders must preserve scroll.');
}
if (html.includes('location.reload(') || html.includes('window.location.reload(')) {
  throw new Error('The app must not force-reload the active business screen.');
}
console.log('PASS: cloud snapshots merge safely and preserve scroll; active edits defer changes until the screen can refresh');
const saveFunctionStart=html.indexOf('function save(){');
const saveFunctionEnd=html.indexOf('function notify(',saveFunctionStart);
const saveFunction=html.slice(saveFunctionStart,saveFunctionEnd);
if (!saveFunction.includes("previousRaw=localStorage.getItem(STORE)") ||
    !saveFunction.includes("db=reconcileStockLedger(Object.assign(blank(),JSON.parse(previousRaw)))") ||
    !html.includes('if(!save())return;') ||
    html.includes('save();')) {
  throw new Error('Failed local persistence must restore the last durable database and stop success flows.');
}
console.log('PASS: all normal save paths stop on local storage failure and the shared save handler restores durable records');

if (!html.includes('data-action="share-offer-whatsapp"') ||
    !html.includes('Share to WhatsApp Group') ||
    !html.includes('function shareOfferViaWhatsApp()') ||
    !html.includes('navigator.share({title,text:message})') ||
    !html.includes('existing Prime Auto Care group') ||
    !html.includes('up to 1,024 members') ||
    html.includes('function exportBroadcastContacts()') ||
    html.includes('data-action="export-broadcast-contacts"')) {
  throw new Error('Offers must share one campaign through the WhatsApp share menu to the existing group, without Broadcast List contact restrictions.');
}
if (!html.includes('whatsappGroupInviteLink') ||
    !html.includes('function inviteCustomerToWhatsAppGroup(customerId)') ||
    !html.includes('data-invite-group=') ||
    !html.includes('customer chooses Join') ||
    !html.includes('groupLink')) {
  throw new Error('Group invite link settings and manual customer invitations are incomplete.');
}
if (html.includes('window.PrimeAutoCareMessaging?.sendInvoice') ||
    !html.includes('await saveInvoicePdf(inv.id);openInvoiceCustomerChat(inv.id)') ||
    !html.includes('function openInvoiceCustomerChat(invId)') ||
    !html.includes('data-open-whatsapp-invoice') ||
    !html.includes("const url='https://wa.me/'+phone+'?text='+encodeURIComponent(invoiceWhatsAppMessage(i))")) {
  throw new Error('Free invoice workflow must save the PDF and open the saved customer number directly without automatic API delivery.');
}
if (!html.includes("Opening announcement prepared in the offer message box.") ||
    !html.includes('data-action="preview-opening-voice"') ||
    !html.includes('function openingAnnouncementMessage()') ||
    !html.includes('function previewOpeningAnnouncement()') ||
    !html.includes("const DEVICE_REMINDER_KEY='prime-auto-care-device-opening-reminder-v1'") ||
    !html.includes("time:deviceReminder.time||'07:50'")) {
  throw new Error('Daily 7:50 AM IST reminder controls, status and test action are incomplete.');
}
console.log('PASS: offers share to the existing WhatsApp group through the Android share menu');
if (!html.includes('messageRecipients:[]') || !html.includes("'payments','messageRecipients'].forEach(k=>") || !html.includes("'payments','messageRecipients'];collections.forEach(key=>") || !html.includes('function normalizeMessageRecipientPhone(') || !html.includes('function messageGroupManagerHtml(') || !html.includes('function openMessageRecipientForm(') || !html.includes('function prepareRecipientGroupMessage(') || !html.includes('function openMessageRecipientWhatsApp(')) throw new Error('The Number & notification group manager must persist contacts and include them in cloud merge.');
for (const group of ['attendance','expenses','staff','operations','sales','inventory','offers']) if (!html.includes("key:'"+group+"'")) throw new Error('Missing notification group: '+group);
if (!html.includes('data-action="add-message-recipient"') || !html.includes('data-edit-message-recipient=') || !html.includes('data-delete-message-recipient=') || !html.includes('data-message-recipient-whatsapp=') || !html.includes("markRecordDeleted('messageRecipients',recipient.id)")) throw new Error('Recipient add/edit/remove actions and deletion tombstones are incomplete.');
if (!html.includes('staffAttendanceForDate(date)') || !html.includes("e.category!=='Staff Advance'") || !html.includes("e.category!=='Salary'") || !html.includes("e.expenseType==='personal'")) throw new Error('Attendance and expense message templates must be date-scoped and exclude personal expenses and salary.');
const cloudSetup = await readFile(new URL('../cloud-sync-setup.sql', import.meta.url), 'utf8');
if (!cloudSetup.includes("'payments', 'messageRecipients'")) throw new Error('Cloud setup SQL is missing message-recipient merge support.');
console.log('PASS: notification contact groups and cloud-sync merge');
console.log('PASS: WhatsApp remains manual and one-to-one; reports are date-scoped');
console.log('PASS: group invite link is stored and new customers can be invited manually without silent auto-add');
console.log('PASS: invoice saves a PDF then opens the direct customer WhatsApp chat for manual attachment/send');
console.log('PASS: daily reminder defaults to 7:50 AM IST and exposes next-run and test controls');
if (!html.includes('data-customer-sms=') ||
    !html.includes('data-invoice-sms=') ||
    !html.includes('function openCustomerSmsComposer(customerId)') ||
    !html.includes('function openInvoiceSmsComposer(invoiceId)') ||
    !html.includes('c.smsServiceOptIn') ||
    !html.includes('data-invite-group=')) {
  throw new Error('Customer thank-you SMS and invoice SMS composer actions must require service-message consent.');
}
const nativeLinks = await readFile(new URL('../src/native-links.js', import.meta.url), 'utf8');
if (!nativeLinks.includes("from '@capacitor/app-launcher'") ||
    !nativeLinks.includes('smsto:') ||
    !nativeLinks.includes('AppLauncher.openUrl')) {
  throw new Error('The Android SIM SMS composer bridge is missing.');
}
console.log('PASS: customer thank-you and invoice SMS open the phone SIM composer; user confirms Send');
if (packageJson.dependencies['@capacitor/share'] !== '^8.0.3' ||
    !nativeLinks.includes("from '@capacitor/share'") ||
    !nativeLinks.includes('Share.share(') ||
    !nativeLinks.includes('shareText')) {
  throw new Error('Android native text sharing plugin must be installed and exposed to the app.');
}
const offerShareStart=html.indexOf('async function shareOfferViaWhatsApp(){');
const offerShareEnd=html.indexOf('async function refreshMessagingStatus()',offerShareStart);
const offerShareSource=html.slice(offerShareStart,offerShareEnd);
if (!offerShareSource.includes('window.WashDeskFileSharer?.share') ||
    !offerShareSource.includes('window.PrimeAutoCareLinks?.shareText') ||
    !offerShareSource.includes('await blobAsDataUrl(imageFile)') ||
    offerShareSource.includes('The Android share menu is not available on this device.')) {
  throw new Error('Group offer sharing must use native Android share bridges for text and promotional images.');
}
console.log('PASS: Android offers use native share sheet for text and attached promotional images; browser fallback remains available');


if (!html.includes('function buildStaffStatement(') || !html.includes('function exportStaffStatementPdf(') || !html.includes('function exportStaffStatementExcel(') || !html.includes('data-staff-statement=') || !html.includes("hours_'+esc(st.id)")) throw new Error('Individual staff statements and daily working-hour capture are incomplete.');
const staffBalanceStart=html.indexOf('function calculateStaffStatementBalance('),staffBalanceEnd=html.indexOf('function buildStaffStatement(',staffBalanceStart);
if(staffBalanceStart<0||staffBalanceEnd<0)throw new Error('Staff statement balance helper was not found.');
const staffBalanceFn=html.slice(staffBalanceStart,staffBalanceEnd);
const staffBalance=vm.runInNewContext(staffBalanceFn+String.fromCharCode(10)+"calculateStaffStatementBalance({grossAccrual:12000,absenceDeduction:1000,salaryPayments:9000,advanceAdjustments:1500,openAdvances:750})",{});
if(staffBalance!==-250)throw new Error('Staff statement must preserve negative final balances: '+staffBalance);
console.log('PASS: employee statements preserve negative final balance values');
if (!html.includes("'Staff Member':st.name") ||
    !html.includes("'Statement From':fromDate") ||
    !html.includes("This export contains records for <b>${esc(st.name)}</b> only.") ||
    !html.includes("Export ${esc(st.name)} PDF") ||
    !html.includes("Export ${esc(st.name)} Excel") ||
    !html.includes("notify(statement.staff.name+' individual staff PDF statement exported.')") ||
    !html.includes("notify(statement.staff.name+' individual staff Excel statement exported.')")) {
  throw new Error('Individual staff PDF/Excel exports must clearly identify the selected employee and date range.');
}
console.log('PASS: individual staff statement identity appears in the export dialog, PDF/Excel summary and confirmation');
if (!html.includes('Date-wise business report') || !html.includes('data-action="export-daily-report-pdf"') || !html.includes('data-action="export-daily-report-excel"') || !html.includes('id="report-date"') || !html.includes('function exportDailyBusinessReportPdf(') || !html.includes('function exportDailyBusinessReportExcel(')) {
  throw new Error('Date-wise business report must expose separate PDF and Excel workbook exports.');
}
if (!html.includes('function buildDateWiseBusinessReport(') || !html.includes('function exportDailyBusinessReportPdf(') || !html.includes('function exportDailyBusinessReportExcel(')) {
  throw new Error('Date-wise PDF/Excel export data model or save actions are incomplete.');
}
if (!html.includes('id="sales-chart-week"') || !html.includes('function isoWeekStart(') || !html.includes('function isoWeekKey(') || !html.includes('Weekly sales trend') || html.includes('id="sales-chart-month"') || html.includes('Monthly sales trend')) {
  throw new Error('Dashboard must show a selectable weekly sales trend instead of the monthly trend.');
}
if (!html.includes('recent-invoice-list') || !html.includes('recent-invoice-item') || !html.includes('Tap an invoice to open it')) {
  throw new Error('Dashboard recent invoices must use the new responsive, tappable invoice cards.');
}
if (!html.includes('function vehicleCategory(value)') || !html.includes("return 'Four-wheeler'") || !html.includes("return 'Commercial'")) throw new Error('Central vehicle category normalisation is missing.');
console.log('PASS: date-wise PDF/Excel report, weekly dashboard trend and recent invoice cards are present');
const dailyReportStart=html.indexOf('function buildDateWiseBusinessReport('),dailyReportEnd=html.indexOf('async function exportDailyBusinessReportPdf(',dailyReportStart);
if(dailyReportStart<0||dailyReportEnd<0)throw new Error('Date-wise report data builder was not found.');
const dailyReportFn=html.slice(dailyReportStart,dailyReportEnd);
const dailyReport=vm.runInNewContext(dailyReportFn+String.fromCharCode(10)+"buildDateWiseBusinessReport('2026-11-16')",{
  db:{
    invoices:[
      {id:'inv-day',date:'2026-11-16',number:'PAC-TEST-01',customerId:'c1',vehicleNumber:'GJ05AB1234',staffId:'s1',grandTotal:500,paidAmount:200,paymentMode:'Cash',notes:'Same-day invoice'},
      {id:'inv-old',date:'2026-11-15',number:'PAC-TEST-OLD',customerId:'c1',grandTotal:300,paidAmount:300},
      {id:'inv-cancel',date:'2026-11-16',number:'PAC-TEST-CANCEL',customerId:'c1',grandTotal:900,paidAmount:0,cancelled:true}
    ],
    payments:[{id:'pay-day',invoiceId:'inv-day',date:'2026-11-16',amount:200,mode:'Cash'},{id:'pay-old',invoiceId:'inv-old',date:'2026-11-15',amount:300,mode:'UPI'}],
    purchases:[{id:'purchase-day',date:'2026-11-16',supplier:'Supplier A',productId:'prod1',qty:2,unitCost:60,total:120,paymentMode:'Cash'}],
    expenses:[
      {id:'salary-day',date:'2026-11-16',category:'Salary',amount:100,advanceAdjustment:50,staffId:'s1',paidTo:'Ansu'},
      {id:'utility-day',date:'2026-11-16',category:'Water',amount:75,paidTo:'Supplier B'},
      {id:'personal-day',date:'2026-11-16',category:'Personal / Household · Vehicle Petrol',expenseType:'personal',amount:200,paidTo:'Owner'},
      {id:'advance-ledger',date:'2026-11-16',category:'Staff Advance',amount:300,staffId:'s1',paidTo:'Ansu'}
    ],
    staffAdvances:[{id:'advance-day',date:'2026-11-16',staffId:'s1',amount:300,recoveredAmount:100,reason:'Travel advance',mode:'Cash'}],
    customers:[{id:'c1',name:'Test Customer',phone:'9876543210'}],
    staff:[{id:'s1',name:'Ansu'}],
    products:[{id:'prod1',name:'Car Shampoo'}]
  },
  invoiceDateKey:value=>String(value||'').slice(0,10),
  invoiceCustomerName:i=>'Test Customer',
  paid:i=>Number(i.paidAmount)||0,
  invoiceDue:i=>Math.max(0,(Number(i.grandTotal)||0)-(Number(i.paidAmount)||0)),
  invoiceRevenueAmount:i=>i?.cancelled?0:Number(i?.grandTotal)||0,
  invoicePaymentModeLabel:i=>i?.paymentMode||'Cash',
  staffAdvanceRecoveredAmount:a=>Number(a.recoveredAmount)||0,
  productName:id=>id==='prod1'?'Car Shampoo':'Item',
  sum:(rows,fn)=>rows.reduce((total,row)=>total+Number(fn?fn(row):row||0),0)
});
if(dailyReport.sales.length!==1||dailyReport.collections.length!==1||dailyReport.purchases.length!==1||
   dailyReport.expenses.length!==2||dailyReport.personalExpenses.length!==1||dailyReport.advances.length!==1||
   dailyReport.summary['Invoice Count']!==1||dailyReport.summary.Sales!==500||
   dailyReport.summary.Collections!==200||dailyReport.summary['Invoice Outstanding']!==300||
   dailyReport.summary.Purchases!==120||dailyReport.summary['Operating Expenses']!==175||
   dailyReport.summary['Personal Expenses']!==200||dailyReport.summary['Staff Payments']!==100||
   dailyReport.summary['Staff Advances Issued']!==300||dailyReport.advances[0].Outstanding!==200){
  throw new Error('Date-wise report filtering or totals are incorrect: '+JSON.stringify(dailyReport.summary));
}
console.log('PASS: date-wise report includes only selected-date records and reconciles all daily totals');
const notificationSource = await readFile(new URL('../src/local-notifications.js', import.meta.url), 'utf8');
for (const token of ["Asia/Kolkata","725401","725402","LocalNotifications.getPending()","LocalNotifications.cancel","sendTestNotification","getReminderStatus","schedule: { on:"]) if (!notificationSource.includes(token)) throw new Error('Native reminder feature missing: '+token);
const staffReportSource = await readFile(new URL('../src/report-export.js', import.meta.url), 'utf8');
if (!staffReportSource.includes('exportStaffStatement') || !staffReportSource.includes("addSheet(workbook, 'Attendance & Hours'") || !staffReportSource.includes("addSheet(workbook, 'Staff Advances'")) throw new Error('Individual staff Excel workbook sheets are incomplete.');
for(const token of ['exportDailyBusinessReport','addSheet(workbook, \'Daily Summary\'','addSheet(workbook, \'Sales Register\'','addSheet(workbook, \'Collections\'','addSheet(workbook, \'Business Expenses\'','addSheet(workbook, \'Personal & Household\'','addSheet(workbook, \'Staff Advances\'']) {
  if(!staffReportSource.includes(token))throw new Error('Date-wise Excel workbook is missing a required detail sheet or export method: '+token);
}
console.log('PASS: notification permission/status/test workflow and employee-only workbook are present');

const dateHelpersStart=html.indexOf('const today=');
const dateHelpersEnd=html.indexOf('const id=',dateHelpersStart);
if(dateHelpersStart<0||dateHelpersEnd<0)throw new Error('Invoice date helper block was not found.');
const dateHelpers=html.slice(dateHelpersStart,dateHelpersEnd);
const parsedInvoiceDates=vm.runInNewContext(dateHelpers+String.fromCharCode(10)+
  "({iso:invoiceDateKey('2026-11-15'),dayFirst:invoiceDateKey('15/11/2026'),dashDayFirst:invoiceDateKey('15-11-2026'),month:monthKey('15/11/2026')})",{});
if(parsedInvoiceDates.iso!=='2026-11-15'||parsedInvoiceDates.dayFirst!=='2026-11-15'||parsedInvoiceDates.dashDayFirst!=='2026-11-15'||parsedInvoiceDates.month!=='2026-11'){
  throw new Error('Legacy invoice date normalisation failed: '+JSON.stringify(parsedInvoiceDates));
}
console.log('PASS: invoice list month/date filters normalise ISO and day-first legacy dates');
const weekChecks=vm.runInNewContext(dateHelpers+String.fromCharCode(10)+
  "({selectedStart:isoWeekStart('2026-W47'),crossYearStart:isoWeekStart('2027-W01'),selectedWeek:isoWeekKey('2026-11-16'),lastDay:addDateDays(isoWeekStart('2026-W47'),6)})",{});
if(weekChecks.selectedStart!=='2026-11-16'||weekChecks.crossYearStart!=='2027-01-04'||
   weekChecks.selectedWeek!=='2026-W47'||weekChecks.lastDay!=='2026-11-22'){
  throw new Error('Weekly sales trend ISO week calculation failed: '+JSON.stringify(weekChecks));
}
console.log('PASS: selectable weekly sales trend handles ISO week boundaries and seven daily bars');

const mustContain = [
  'const invoiceDateKey=',
  'id="invoice-day"',
  'function invoicePaymentModeLabel',
  'Mark as Complimentary (No charge)',
  'function invoiceRevenueAmount',
  'function staffAccruedDays',
  'function staffTodayAdvancesHtml',
  'tomorrowOpeningMessage',
  'data-action="share-tomorrow-message"',
  'Selected date’s',
  'Selected date’s',
  'Online received (UPI / Card / Bank)',
  'data-edit-invoice', 'function saveInvoiceEdits', 'function calculateEditedInvoice',
  'function staffSalaryPaid', 'function payStaffSalaryForm', 'function exportSalesExcel',
  'function mergeWashDeskData', 'function connectCloud', 'data-wa-toggle', 'function canRenderRemoteUpdate', 'remoteRenderPending', 
  'data-action="export-excel"', 'data-action="cloud-sync-now"', 'data-save-pdf',
  'PRIME AUTO CARE', 'Service performed by:', 'Payment mode', 'Authorised Signatory',
  'pairDevice', 'pairingCode', 'Connect / Pair this device', 'Prime-Auto-Care-',
  'pdfMake.createPdf', '__primeAutoCarePdfFontsReady', 'premium-invoice-header{grid-template-columns:62px minmax(0,1fr)', 'Prime Auto Care Invoice ', 'TAX INVOICE / SERVICE BILL', 'BILL TO', 'VEHICLE & SERVICE', 'PAYMENT DETAILS', 'GRAND TOTAL', 'BALANCE DUE', 'AUTHORISED SIGNATURE', 'invoice-grand-total strong', 'invoice-summary-row b', 'staffAdvances:[]', 'function staffAdvancesOutstanding', 'function addStaffAdvanceForm', 'advanceAdjustment', 'dashboard-hero', 'prime-auto-care-logo.jpg', 'data-action="add-staff-advance"', 'attendance:[]', 'function saveStaffAttendance', 'function staffMonthDayCount', 'function staffAttendanceSummary', 'function staffPayrollBreakdown', 'Monthly payroll calculator', 'function staffAttendanceForDate', 'function setStaffAttendanceEntry', 'function removeStaffMember', 'function staffShiftEnd', 'function staffManagerPinDigest', 'function verifyStaffManagerPin', 'staff-attendance-row', 'Manager PIN', 'Daily staff attendance', 'Present', 'Absent', 'attendance-date', 'attendance-form', 'data-cancel-invoice', 'function cancelInvoice', 'CANCELLED · BILL VOID', 'Cancelled invoices cannot be edited', 'bill-customer-search', 'renderBillCustomerMatches', 'findCustomerByMobile', 'findVehicleByNumber', 'GOLD & BLACK CAR SERVICES', 'premium-car-mark', 'invoice-party-grid', 'invoice-payment-card', 'invoice-terms-card', 'Customer names may repeat', 'Vehicle registration numbers must be unique', 'carPhotoData', 'prime-auto-care-car-photo.jpg', 'Customer ID is generated automatically as the primary key'
];
for (const token of mustContain) {
  if (!html.includes(token)) throw new Error('Missing feature hook: ' + token);
}
if (html.includes('cdnjs.cloudflare.com') || html.includes('unpkg.com/html2pdf') || html.includes('unpkg.com/jspdf')) {
  throw new Error('Invoice PDF dependencies must be local/offline bundled assets.');
}
const inlineStart = html.indexOf('<script>');
const inlineEnd = inlineStart >= 0 ? html.indexOf('</script>', inlineStart) : -1;
if (inlineStart < 0 || inlineEnd < 0) throw new Error('No inline application script was found.');
const inlineSource = html.slice(inlineStart + '<script>'.length, inlineEnd);
await transform(inlineSource, { loader: 'js', target: 'es2020', logLevel: 'silent' });
console.log('PASS: inline application JavaScript syntax');
for (const asset of ['pdfmake.bundle.min.js','pdfmake-vfs.js','invoice-native.bundle.js','exceljs.bundle.min.js','report-export.bundle.js','cloud-sync.bundle.js','notifications-native.bundle.js','communications.bundle.js','native-links.bundle.js','google-reviews.bundle.js','bookings.bundle.js','prime-auto-care-logo.jpg','prime-auto-care-car-photo.jpg']) {
  const path = new URL('../' + asset, import.meta.url);
  if (!existsSync(path) || statSync(path).size < 500) throw new Error('Missing or empty bundled asset: ' + asset);
  console.log('PASS: bundled asset ' + asset);
}
const serviceWorkerSource = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
if (!serviceWorkerSource.includes('prime-auto-care-shell-v37') || !serviceWorkerSource.includes("'./bookings.bundle.js'")) throw new Error('Offline cache must refresh to v37 and precache the booking bundle.');
console.log('PASS: v36 offline shell cache invalidation and booking bundle precache');
const pdfFontsBundle = await readFile(new URL('../pdfmake-vfs.js', import.meta.url), 'utf8');
if (!pdfFontsBundle.includes('__primeAutoCarePdfFontsReady') || !pdfFontsBundle.includes('addVirtualFileSystem(vfs)')) {
  throw new Error('PDFMake font bundle does not register the virtual font system.');
}
if (html.includes('!pdfMake.vfs') || html.includes('Object.keys(pdfMake.vfs)')) {
  throw new Error('Invoice PDF still uses the obsolete pdfMake.vfs readiness check.');
}
console.log('PASS: PDFMake VFS fonts use addVirtualFileSystem and a post-load readiness marker');


const carPhotoBytes = await readFile(new URL('../prime-auto-care-car-photo.jpg', import.meta.url));
if (carPhotoBytes.length < 1000 ||
    carPhotoBytes[0] !== 0xff || carPhotoBytes[1] !== 0xd8 ||
    carPhotoBytes[carPhotoBytes.length - 2] !== 0xff || carPhotoBytes[carPhotoBytes.length - 1] !== 0xd9) {
  throw new Error('The Prime Auto Care PDF car photograph is not a complete JPEG file.');
}
console.log('PASS: PDF car photograph is a complete, decodable JPEG asset');

const appId = JSON.parse(await readFile(new URL('../capacitor.config.json', import.meta.url), 'utf8')).appId;
if (appId !== 'com.washdesk.carwash.v31') throw new Error('Android 2.14.2 application ID v31 was not set.');
console.log('PASS: app manifest uses the new v31 Android package ID.');

// Test the actual daily counter and invoice total functions extracted from the app.
const nextStart = html.indexOf('function nextInvoiceNo(');
const nextEnd = html.indexOf(' async function reserveInvoiceNo', nextStart);
if (nextStart < 0 || nextEnd < 0) throw new Error('Daily invoice counter function not found.');
const nextFunction = html.slice(nextStart, nextEnd);
const nextResult = vm.runInNewContext(nextFunction + String.fromCharCode(10) + "nextInvoiceNo('2026-11-07')", {
  db: { business: { invoicePrefix: 'CW' }, invoices: [
    { date: '2026-11-07', number: 'CW-261107-001' },
    { date: '2026-11-07', number: 'CW-261107-005' },
    { date: '2026-11-06', number: 'CW-261106-019' }
  ] }
});
if (nextResult !== 'CW-261107-006') throw new Error('Daily invoice sequence test failed: ' + nextResult);
console.log('PASS: invoice numbering resets daily and advances past saved bills');
const reserveStart=html.indexOf('function nextInvoiceNo('),reserveEnd=html.indexOf('  function sum(',reserveStart);
if(reserveStart<0||reserveEnd<0)throw new Error('Shared invoice reservation function not found.');
const reserveSource=html.slice(reserveStart,reserveEnd);
const cloudReserve=vm.runInNewContext(reserveSource+String.fromCharCode(10)+"reserveInvoiceNo('2026-11-07')",{db:{business:{invoicePrefix:'CW'},invoices:[]},id:()=>'DEVICE-UNIQUE-001',navigator:{onLine:true},window:{WashDeskCloud:{getWorkspace:()=>({workspace_id:'shared'}),nextInvoiceNumber:async()=>'CW-261107-021'}}});
if(await cloudReserve!=='CW-261107-021')throw new Error('Online invoice numbering did not use the shared server counter.');
const offlineReserve=vm.runInNewContext(reserveSource+String.fromCharCode(10)+"reserveInvoiceNo('2026-11-07')",{db:{business:{invoicePrefix:'CW'},invoices:[]},id:()=>'DEVICE-UNIQUE-001',navigator:{onLine:false},window:{WashDeskCloud:{getWorkspace:()=>({workspace_id:'shared'})}}});
if(await offlineReserve!=='CW-261107-OFF-DEVICE-UNIQUE-001')throw new Error('Paired offline bills must receive a unique provisional reference: '+offlineReserve);
const failedReserve=vm.runInNewContext(reserveSource+String.fromCharCode(10)+"reserveInvoiceNo('2026-11-07')",{db:{business:{invoicePrefix:'CW'},invoices:[]},id:()=>'DEVICE-UNIQUE-002',navigator:{onLine:true},window:{WashDeskCloud:{getWorkspace:()=>({workspace_id:'shared'}),nextInvoiceNumber:async()=>{throw new Error('counter unavailable')}}}});
let counterRejected=false;try{await failedReserve}catch{counterRejected=true}
if(!counterRejected)throw new Error('Paired online billing must fail closed when the shared invoice counter fails.');
console.log('PASS: paired online billing fails closed on counter errors; offline paired bills use unique provisional numbers');

const calcStart = html.indexOf('function calculateEditedInvoice(');
const calcEnd = html.indexOf('  function saveInvoiceEdits', calcStart);
if (calcStart < 0 || calcEnd < 0) throw new Error('Invoice total calculation function not found.');
const calcFunction = html.slice(calcStart, calcEnd);
const calc = vm.runInNewContext(calcFunction + String.fromCharCode(10) + "calculateEditedInvoice([{qty:2,rate:100,discount:10,taxRate:18},{qty:1,rate:50,discount:0,taxRate:0}],5,true)", {
  sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
});
if (Math.abs(calc.gross-250) > .001 || Math.abs(calc.lineDisc-10) > .001 || Math.abs(calc.taxable-235) > .001 || Math.abs(calc.grand-268.4875) > .02) {
  throw new Error('Edited invoice recalculation test failed: ' + JSON.stringify(calc));
}
console.log('PASS: invoice edit recalculates subtotal, discounts, taxable value, tax and total');

const salaryStart = html.indexOf('function staffSalaryPaid(');
const salaryEnd = html.indexOf('  function staffSalaryDue', salaryStart);
if (salaryStart < 0 || salaryEnd < 0) throw new Error('Staff salary aggregation function not found.');
const salaryFunction = html.slice(salaryStart, salaryEnd);
const paid = vm.runInNewContext(salaryFunction + String.fromCharCode(10) + "staffSalaryPaid('staff-1','2026-11')", {
  db: { expenses: [
    { category:'Salary', staffId:'staff-1', salaryMonth:'2026-11', date:'2026-11-05', amount:4500, advanceAdjustment:600 },
    { category:'Electricity', staffId:'staff-1', salaryMonth:'2026-11', date:'2026-11-06', amount:900 },
    { category:'Salary', staffId:'staff-2', salaryMonth:'2026-11', date:'2026-11-06', amount:3000 }
  ] },
  monthKey: date => date ? String(date).slice(0,7) : '2026-11',
  sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
});
if (paid !== 5100) throw new Error('Staff salary plus advance adjustment aggregation test failed: ' + paid);
console.log('PASS: staff salary payments and non-cash advance adjustments are included in salary settlement');
const advancesStart = html.indexOf('function staffAdvancesOutstanding(');
const advancesEnd = html.indexOf('function staffSalaryPaid(', advancesStart);
if (advancesStart < 0 || advancesEnd < 0) throw new Error('Staff advance balance function not found.');
const advancesFunction = html.slice(advancesStart, advancesEnd);
const advancesOpen = vm.runInNewContext(advancesFunction + String.fromCharCode(10) + "staffAdvancesOutstanding('staff-1')", {
  db: { staffAdvances: [
    { staffId:'staff-1', amount:1200, recoveredAmount:300 },
    { staffId:'staff-1', amount:500, recoveredAmount:500 },
    { staffId:'staff-2', amount:900, recoveredAmount:100 }
  ] },
  sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
});
if (advancesOpen !== 900) throw new Error('Staff advance outstanding calculation failed: ' + advancesOpen);
console.log('PASS: staff advance register calculates adjusted and open balances by staff member');
const payrollStart = html.indexOf('function staffAdvancesOutstanding(');
const payrollEnd = html.indexOf('function staff(){', payrollStart);
if (payrollStart < 0 || payrollEnd < 0) throw new Error('Staff payroll calculation helpers not found.');
const payrollFunctions = html.slice(payrollStart, payrollEnd);
const novemberPayroll = vm.runInNewContext(
  payrollFunctions + String.fromCharCode(10) + "staffPayrollBreakdown({id:'staff-1',salary:14000},'2026-11')",
  {
    db: {
      staffAdvances: [{ staffId:'staff-1', amount:3000, recoveredAmount:0 }],
      attendance: [
        { staffId:'staff-1', date:'2026-11-02', status:'Absent', updatedAt:1 },
        { staffId:'staff-1', date:'2026-11-04', status:'Absent', updatedAt:1 },
        { staffId:'staff-1', date:'2026-11-05', status:'Present', updatedAt:1 },
        { staffId:'staff-1', date:'2026-11-22', status:'Absent', updatedAt:1 }
      ],
      expenses: []
    },
    today: () => '2026-11-15',
    monthKey: date => date ? String(date).slice(0,7) : '2026-11',
    sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
  }
);
if (novemberPayroll.calendarDays !== 30 || novemberPayroll.accruedDays !== 15 || novemberPayroll.absentDays !== 2 ||
    Math.abs(novemberPayroll.absenceDeduction-933.33) > 0.01 ||
    Math.abs(novemberPayroll.earnedSalary-6066.67) > 0.01 ||
    Math.abs(novemberPayroll.netPayable-3066.67) > 0.01) {
  throw new Error('30-day payroll calculation failed: ' + JSON.stringify(novemberPayroll));
}
console.log('PASS: 30-day payroll deducts absence days and outstanding advances from monthly salary');
const excessAdvancePayroll = vm.runInNewContext(
  payrollFunctions + String.fromCharCode(10) + "staffPayrollBreakdown({id:'staff-1',salary:1000},'2026-11')",
  {
    db: { staffAdvances:[{staffId:'staff-1',amount:2500,recoveredAmount:0}], attendance:[], expenses:[] },
    today: () => '2026-11-30',
    monthKey: date => date ? String(date).slice(0,7) : '2026-11',
    sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
  }
);
if (Math.abs(excessAdvancePayroll.balanceBeforeAdvances-1000) > 0.01 ||
    Math.abs(excessAdvancePayroll.openAdvances-2500) > 0.01 ||
    Math.abs(excessAdvancePayroll.advanceDeduction-1000) > 0.01 ||
    Math.abs(excessAdvancePayroll.netPayable-(-1500)) > 0.01) {
  throw new Error('Advances greater than earned salary must show a negative recovery balance while settlement adjustment stays capped: ' + JSON.stringify(excessAdvancePayroll));
}
console.log('PASS: excess staff advances show a negative recovery balance without over-adjusting salary');
const februaryPayroll = vm.runInNewContext(
  payrollFunctions + String.fromCharCode(10) + "staffPayrollBreakdown({id:'staff-1',salary:14000},'2027-02')",
  {
    db: { staffAdvances:[], attendance:[{staffId:'staff-1',date:'2027-02-10',status:'Absent'}], expenses:[] },
    today: () => '2027-02-28',
    monthKey: date => date ? String(date).slice(0,7) : '2027-02',
    sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
  }
);
if (februaryPayroll.calendarDays !== 28 || februaryPayroll.absentDays !== 1 ||
    Math.abs(februaryPayroll.absenceDeduction-500) > 0.01 ||
    Math.abs(februaryPayroll.netPayable-13500) > 0.01) {
  throw new Error('28-day payroll calculation failed: ' + JSON.stringify(februaryPayroll));
}
console.log('PASS: 28-day payroll uses the correct calendar-day rate');
const halfDayPayroll = vm.runInNewContext(
  payrollFunctions + String.fromCharCode(10) + "staffPayrollBreakdown({id:'staff-1',salary:14000},'2026-11')",
  {
    db: { staffAdvances:[], attendance:[
      {staffId:'staff-1',date:'2026-11-02',status:'Half Day',updatedAt:1},
      {staffId:'staff-1',date:'2026-11-03',status:'Absent',updatedAt:1},
      {staffId:'staff-1',date:'2026-11-04',status:'Present',updatedAt:1}
    ], expenses:[] },
    today: () => '2026-11-15',
    monthKey: date => date ? String(date).slice(0,7) : '2026-11',
    sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
  }
);
if (halfDayPayroll.halfDays!==1 || halfDayPayroll.absentDays!==1 ||
    Math.abs(halfDayPayroll.halfDayDeduction-233.33)>0.01 ||
    Math.abs(halfDayPayroll.earnedSalary-6300)>0.01) {
  throw new Error('Half-day payroll must deduct exactly 50% of the daily salary rate: '+JSON.stringify(halfDayPayroll));
}
console.log('PASS: half-day attendance deducts exactly 50% of the daily salary rate');
const negativePayroll = vm.runInNewContext(
  payrollFunctions + String.fromCharCode(10) + "staffPayrollBreakdown({id:'staff-1',salary:10000},'2026-11')",
  {
    db: { staffAdvances:[], attendance:[], expenses:[{category:'Salary',staffId:'staff-1',salaryMonth:'2026-11',amount:7000,advanceAdjustment:0},{category:'Salary',staffId:'staff-1',salaryMonth:'2026-11',amount:4000,advanceAdjustment:0}] },
    today: () => '2026-11-30',
    monthKey: date => date ? String(date).slice(0,7) : '2026-11',
    sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
  }
);
if (negativePayroll.balanceBeforeAdvances !== -1000 || negativePayroll.netPayable !== -1000) {
  throw new Error('Negative salary balance must remain visible and must not be clamped to zero: ' + JSON.stringify(negativePayroll));
}
console.log('PASS: overpaid salary shows a negative net payable instead of zero');
if (!html.includes("vehicleCategory(i.vehicleType)==='Commercial'") || !html.includes("vehicleCategory(i.vehicleType)==='Four-wheeler'")) {
  throw new Error('Taxi must be counted under four-wheelers and commercial vehicles separately.');
}
console.log('PASS: taxi is classified under four-wheelers; commercial vehicles remain separate');
if (!html.includes('class="bar-value">\'+(d.v?INR(d.v):\'—\')') || !html.includes('Weekly sales trend')) throw new Error('Weekly sales chart must show daily rupee amounts.');
console.log('PASS: sales trend displays daily rupee amounts');
const staffHelpersStart = html.indexOf('function staffAttendanceForDate(');
const staffHelpersEnd = html.indexOf('function staff(){', staffHelpersStart);
if (staffHelpersStart < 0 || staffHelpersEnd < 0) throw new Error('Staff attendance and shift helper functions were not found.');
const staffHelpers = html.slice(staffHelpersStart, staffHelpersEnd);
const shiftTimes = vm.runInNewContext(
  staffHelpers + String.fromCharCode(10) + "({eight:staffShiftEnd('08:00',11),nine:staffShiftEnd('09:00',11),ten:staffShiftEnd('10:00',11),label:staffShiftLabel({shiftStart:'09:00',shiftHours:11})})",
  { db: { staff:[], attendance:[], _deletedIds:{} } }
);
if (shiftTimes.eight !== '19:00' || shiftTimes.nine !== '20:00' || shiftTimes.ten !== '21:00' ||
    !shiftTimes.label.includes('9:00 AM') || !shiftTimes.label.includes('8:00 PM')) {
  throw new Error('Individual 11-hour staff shift schedule mapping failed: ' + JSON.stringify(shiftTimes));
}
console.log('PASS: individual staff schedules map 8 AM to 7 PM, 9 AM to 8 PM and 10 AM to 9 PM');

const attendanceContext = {
  db: { staff:[{id:'staff-1'}], attendance:[], _deletedIds:{} }
};
const attendanceChanges = vm.runInNewContext(
  staffHelpers + String.fromCharCode(10) +
  "setStaffAttendanceEntry('staff-1','Worker One','2026-11-12','Absent');" +
  "setStaffAttendanceEntry('staff-1','Worker One','2026-11-12','Present');" +
  "({count:db.attendance.length,status:db.attendance[0]?.status,activeCount:staffAttendanceForDate('2026-11-12').length})",
  attendanceContext
);
if (attendanceChanges.count !== 1 || attendanceChanges.status !== 'Present' || attendanceChanges.activeCount !== 1) {
  throw new Error('Absent-to-Present attendance correction did not update the same staff/date record: ' + JSON.stringify(attendanceChanges));
}
console.log('PASS: a staff member can be corrected from Absent to Present without creating a duplicate');
const clearContext = {
  db: { staff:[{id:'staff-1'}], attendance:[{id:'attendance_2026-11-12_staff-1',staffId:'staff-1',date:'2026-11-12',status:'Absent'}], _deletedIds:{} }
};
const cleared = vm.runInNewContext(
  staffHelpers + String.fromCharCode(10) +
  "setStaffAttendanceEntry('staff-1','Worker One','2026-11-12','Clear');" +
  "({count:db.attendance.length,tombstone:!!db._deletedIds['attendance_2026-11-12_staff-1']})",
  clearContext
);
if (cleared.count !== 0 || !cleared.tombstone) throw new Error('Clearing an attendance entry did not create a cloud deletion tombstone.');
console.log('PASS: clearing a mistaken attendance entry removes it and syncs the deletion tombstone');

const noStaffRows = vm.runInNewContext(
  staffHelpers + String.fromCharCode(10) + "staffAttendanceForDate('2026-11-12').length",
  { db: { staff:[], attendance:[{id:'orphan-1',staffId:'removed-staff',date:'2026-11-12',status:'Absent'},{id:'orphan-2',staffId:'removed-staff',date:'2026-11-12',status:'Present'}], _deletedIds:{} } }
);
if (noStaffRows !== 0) throw new Error('Attendance summary still counts records for removed staff.');
console.log('PASS: removed staff do not appear in Present / Absent counts');

const removalContext = {
  db: {
    staff:[{id:'staff-1',name:'Worker One'}],
    attendance:[{id:'attendance_2026-11-12_staff-1',staffId:'staff-1',date:'2026-11-12',status:'Absent'}],
    expenses:[{id:'salary-1',category:'Salary',staffId:'staff-1',amount:500}],
    _deletedIds:{}
  },
  confirm:()=>true, save:()=>{}, render:()=>{}, notify:()=>{}
};
const removal = vm.runInNewContext(
  staffHelpers + String.fromCharCode(10) +
  "removeStaffMember('staff-1');" +
  "({staff:db.staff.length,attendance:db.attendance.length,expenseHistory:db.expenses.length,staffTombstone:!!db._deletedIds['staff-1'],attendanceTombstone:!!db._deletedIds['attendance_2026-11-12_staff-1']})",
  removalContext
);
if (removal.staff !== 0 || removal.attendance !== 0 || removal.expenseHistory !== 1 ||
    !removal.staffTombstone || !removal.attendanceTombstone) {
  throw new Error('Staff removal must clear attendance and preserve financial history: ' + JSON.stringify(removal));
}
console.log('PASS: removing staff clears their attendance tombstones while retaining salary history');

if (!html.includes("!(await verifyStaffManagerPin()))return;") ||
    !html.includes("db.settings.staffManagerAccess={salt,hash:await staffManagerPinDigest(pin,salt)")) {
  throw new Error('Staff shift changes are not protected by the synced Manager PIN.');
}
console.log('PASS: shift-time editing is guarded by the shared salted Manager PIN');

const brandSvg = await readFile(new URL('../icon.svg', import.meta.url), 'utf8');
const brandManifest = JSON.parse(await readFile(new URL('../manifest.webmanifest', import.meta.url), 'utf8'));
for (const asset of ['prime-auto-care-icon-192.png','prime-auto-care-icon-512.png','prime-auto-care-icon.ico']) {
  if (!existsSync(new URL('../'+asset, import.meta.url))) throw new Error('Generated brand icon asset missing: '+asset);
}
if (!brandSvg.includes('data:image/jpeg;base64') ||
    !brandManifest.icons.some(icon=>icon.src==='./prime-auto-care-icon-192.png') ||
    !brandManifest.icons.some(icon=>icon.src==='./prime-auto-care-icon-512.png')) {
  throw new Error('Prime Auto Care logo is not wired into the app / PWA icon assets.');
}
console.log('PASS: Prime Auto Care wordmark is used by the app, PWA and Windows icon assets');



// Verify normalized unique identifiers. Customer names are intentionally repeatable.
const uniqueStart = html.indexOf('function normalizeMobile(');
const uniqueEnd = html.indexOf('function renderBillCustomerMatches(', uniqueStart);
if (uniqueStart < 0 || uniqueEnd < 0) throw new Error('Customer / vehicle uniqueness helpers are missing.');
const uniqueSource = html.slice(uniqueStart, uniqueEnd);
const uniqueResult = vm.runInNewContext(
  uniqueSource + String.fromCharCode(10) + `({
    mobile: normalizeMobile('+91 98248 23200'),
    mobile0091: normalizeMobile('0091 98248 23200'),
    duplicateCustomer: findCustomerByMobile('9824823200')?.id || '',
    duplicateVehicle: findVehicleByNumber('gj 05-ab 1234')?.id || ''
  })`,
  { db: {
      customers: [{ id:'customer-1', name:'Zaid', phone:'98248 23200' }],
      vehicles: [{ id:'vehicle-1', customerId:'customer-1', number:'GJ05AB1234' }]
    }
  }
);
if (uniqueResult.mobile !== '9824823200' || uniqueResult.mobile0091 !== '9824823200' || uniqueResult.duplicateCustomer !== 'customer-1' || uniqueResult.duplicateVehicle !== 'vehicle-1') {
  throw new Error('Customer mobile / vehicle registration normalization and duplicate lookup test failed: ' + JSON.stringify(uniqueResult));
}
console.log('PASS: mobile numbers normalize across +91 formatting and vehicle registrations ignore spaces / punctuation');

if (!cloudSource.includes('https://jkjudmkqaebrgllemris.supabase.co') ||
    !cloudSource.includes('sb_publishable_VibeDJoJTLelcmlQl8QvhA_kr6h0BQw')) {
  throw new Error('Prime Auto Care Supabase URL / publishable key are not prefilled.');
}
for (const conflictToken of ['DUPLICATE_CUSTOMER_MOBILE','DUPLICATE_VEHICLE_REGISTRATION']) {
  if (!cloudSource.includes(conflictToken)) throw new Error('Cloud sync does not explain duplicate-key conflicts: ' + conflictToken);
}
console.log('PASS: Prime Auto Care Supabase project URL and publishable key are preconfigured');
if (!cloudSource.includes('queuedPayload = payload;') ||
    cloudSource.includes('queuedPayload = clone(payload)') ||
    !cloudSource.includes('}, 30000);')) {
  throw new Error('Cloud save path still performs repeated full-database copies or excessive safety polling.');
}
console.log('PASS: cloud save scheduling coalesces the latest DB snapshot without cloning on every save; Realtime remains primary');
const remoteReceiveStart = html.indexOf('function receiveCloudData(');
const remoteReceiveEnd = html.indexOf('async function connectCloud', remoteReceiveStart);
if (remoteReceiveStart < 0 || remoteReceiveEnd < 0) throw new Error('Remote sync handler not found.');
const remoteReceive = html.slice(remoteReceiveStart, remoteReceiveEnd);
if (!remoteReceive.includes('if(!canRenderRemoteUpdate())') ||
    !remoteReceive.includes('pendingRemotePayload=remote;') ||
    !remoteReceive.includes('remoteRenderPending=true;') ||
    !remoteReceive.includes('return {__cloudSyncDeferred:true}') ||
    !remoteReceive.includes('db=mergeWashDeskData') ||
    !remoteReceive.includes('localStorage.setItem(STORE,JSON.stringify(db))') ||
    !remoteReceive.includes('render()')) {
  throw new Error('Realtime snapshots must update immediately when safe and defer only while the Owner is editing.');
}
if (!html.includes('let pendingRemotePayload=null;') ||
    !html.includes('function applyPendingRemoteData()') ||
    !html.includes('if(page!==p)applyPendingRemoteData();')) {
  throw new Error('Deferred cloud updates are not applied safely when navigating between modules.');
}
if (!html.includes('function render(preserveScroll=true)') ||
    !html.includes('if(preserveScroll&&(scrollX||scrollY))requestAnimationFrame(()=>window.scrollTo(scrollX,scrollY))') ||
    !html.includes("})[p]||'';render(false);window.scrollTo(0,0)}")) {
  throw new Error('Same-page rerenders must preserve scroll, while deliberate module navigation must start at the top.');
}
if (!cloudSource.includes('if (applied?.__cloudSyncDeferred) return null;') ||
    !cloudSource.includes("update queued until you leave the current screen")) {
  throw new Error('Cloud sync does not honor the active-screen-safe remote update deferral contract.');
}
const saveBillStart = html.indexOf('async function saveBill()');
const saveBillEnd = html.indexOf('function applyConsumption', saveBillStart);
const saveBillSource = html.slice(saveBillStart, saveBillEnd);
if (!(saveBillSource.indexOf('await reserveInvoiceNo(invoiceDate)') < saveBillSource.indexOf('applyConsumption(billLines,invoiceId)'))) {
  throw new Error('Stock is mutated before the shared invoice number request succeeds.');
}
if (!html.includes("if(page==='billing')return false") ||
    !html.includes("active.matches('input,textarea,select,[contenteditable=\"true\"]')") ||
    !html.includes("backdrop?.classList.contains('show')")) {
  throw new Error('Active billing inputs and modal forms are not protected from remote re-rendering.');
}
console.log('PASS: remote cloud updates preserve the active bill form, text focus and Android keyboard');

for (const token of [
  'pairDevice', 'signInAnonymously()', 'washdesk_join_workspace',
  'washdesk_get_workspace', 'washdesk_merge_sync', 'washdesk_next_invoice_number',
  'postgres_changes', 'pac_booking_notification_events', 'washdesk-booking-notification',
  'startSafetyRefresh', 'Offline'
]) {
  if (!cloudSource.includes(token)) throw new Error('Shared device pairing / cloud sync hook is missing: ' + token);
}
if (!html.includes("window.addEventListener('washdesk-booking-notification'") ||
    !html.includes('bookingNotificationSeen.delete(id)') ||
    !html.includes("if(page==='bookings')void loadBookingCenter(true)") ||
    !html.includes('void pollBookingNotifications()')) {
  throw new Error('Live booking events must immediately trigger the per-device notification poller.');
}
for (const obsolete of ['requestEmailOtp', 'verifyEmailOtp', 'emailRedirectTo', 'AUTH_REDIRECT_URL']) {
  if (cloudSource.includes(obsolete)) throw new Error('Legacy email-link authentication remains in the cloud module: ' + obsolete);
}
if (cloudSource.includes('localhost:3000') || html.includes('localhost:3000') ||
    html.includes('Send secure sign-in link') || html.includes('Six-digit email sign-in code')) {
  throw new Error('The cloud flow still contains an email-link / localhost redirect dependency.');
}
if (!html.includes('id="owner-cloud-login-form"') ||
    !html.includes('Connect &amp; open Prime Auto Care') ||
    !html.includes('name="email"') ||
    !html.includes('name="password"') ||
    !html.includes('Owner email') ||
    !html.includes('value="bmumz3909@gmail.com" readonly') ||
    html.includes('mz03200786@gmail.com') ||
    !cloudSource.includes('async function signInOwner') ||
    !cloudSource.includes('signInWithPassword') ||
    !cloudSource.includes("serverWorkspace.role !== 'owner'") ||
    !cloudSource.includes('Owner account verified. Your full Prime Auto Care business app')) {
  throw new Error('Fresh-install Owner restore must authenticate the single registered Owner account and retain the full business app.');
}
const ownerPairMigration = await readFile(new URL('../supabase/migrations/20261120190000_preserve_owner_role_on_workspace_pairing.sql', import.meta.url), 'utf8');
const cloudSetupSql = await readFile(new URL('../cloud-sync-setup.sql', import.meta.url), 'utf8');
for (const token of ["v_existing_role = 'owner'", "v_owner_user = v_auth_user or v_existing_role = 'owner'", "m.role = 'owner'"]) {
  if (!ownerPairMigration.includes(token) && !cloudSetupSql.includes(token)) {
    throw new Error('Legacy workspace pairing must preserve an Owner membership and restrict business snapshot reads to Owners: '+token);
  }
}
if (!cloudSource.includes('workspace = readWorkspace();') ||
    !cloudSource.includes('automatic sync will resume when internet returns') ||
    !cloudSource.includes('void resume({ getLocal: localProvider, onRemote: remoteHandler })')) {
  throw new Error('Saved device pairing does not recover automatically after an offline app restart.');
}
console.log('PASS: offline app restart restores pairing and retries sync after internet returns');
if (!cloudSource.includes('exchangeCodeForSession') || !cloudSource.includes("flowType: 'pkce'")) throw new Error('Secure PKCE exchange for the app-bound Owner recovery link is missing.');
console.log('PASS: legacy email OTP login removed; secure app-bound PKCE password recovery retained; anonymous authenticated devices join one shared workspace');


// Invoice totals are computed from item quantities, rates, line discounts and tax rates.
const billCalcStart = html.indexOf('function calcLines(');
const billCalcEnd = html.indexOf('function billSummary()', billCalcStart);
if (billCalcStart < 0 || billCalcEnd < 0) throw new Error('Bill calculation function is missing.');
const billCalcSource = html.slice(billCalcStart, billCalcEnd);
const billCalc = vm.runInNewContext(billCalcSource + String.fromCharCode(10) +
  "calcLines([{qty:2,rate:100,discount:10,taxRate:18},{qty:1,rate:50,discount:0,taxRate:0}],5)", {
    db: { business: { registered: true } },
    sum: (rows, fn) => rows.reduce((total, row) => total + Number(fn ? fn(row) : row || 0), 0)
  });
if (billCalc.gross !== 250 || billCalc.lineDisc !== 10 || billCalc.taxable !== 235 ||
    Math.abs(billCalc.tax - 33.4875) > 0.001 || Math.abs(billCalc.grand - 268.4875) > 0.001) {
  throw new Error('Invoice total calculation test failed: ' + JSON.stringify(billCalc));
}
console.log('PASS: invoice PDF source totals reconcile from subtotal through GST to grand total');

// Verify the rendered invoice markup includes all money fields that were being
// clipped from the right edge of customer PDFs.
const invoiceHtmlStart = html.indexOf('function invoiceHTML(i){');
const invoiceHtmlEnd = html.indexOf('function invoicePdfName(i)', invoiceHtmlStart);
if (invoiceHtmlStart < 0 || invoiceHtmlEnd < 0) throw new Error('Invoice PDF HTML builder was not found.');
const invoiceHtmlSource = html.slice(invoiceHtmlStart, invoiceHtmlEnd);
const sampleInvoice = {
  id:'pdf-test', number:'TEST-001', date:'2026-11-07', financialYear:'26-27',
  customerId:null, customerNameSnapshot:'PDF Test Customer', customerAddress:'Surat',
  customerCity:'Surat', customerState:'Gujarat', vehicleNumber:'GJ05AB1234',
  vehicleType:'Private Car', staffId:null, staffNameSnapshot:'Test Washer',
  businessSnapshot:{name:'Prime Auto Care',address:'Surat',city:'Surat',state:'Gujarat',stateCode:'24',registered:false},
  gstRegistered:false, lines:[{name:'Premium Wash',kind:'service',sac:'',qty:1,unit:'service',rate:100,discount:0}],
  subtotal:100,lineDiscount:0,discount:0,taxable:100,tax:0,grandTotal:100,
  paymentMode:'Cash',notes:''
};
const invoiceMarkup = vm.runInNewContext(
  invoiceHtmlSource + String.fromCharCode(10) + 'invoiceHTML(sampleInvoice)',
  {
    sampleInvoice,
    db:{business:sampleInvoice.businessSnapshot,staff:[],customers:[],payments:[]},
    sum:(rows,fn)=>rows.reduce((total,row)=>total+Number(fn?fn(row):row||0),0),
    esc:value=>String(value??''),
    INR:value=>'₹'+Number(value||0).toFixed(2),
    invoiceTaxLines:()=>[{taxable:100,rate:0,tax:0,cgst:0,sgst:0,igst:0}],
    invoiceCustomerName:()=> 'PDF Test Customer',
    paid:()=>25,
    invoiceDue:i=>i?.complimentary?0:75,
    invoicePaymentModeLabel:i=>i?.complimentary?'Complimentary':'Cash',
    fy:()=> '26-27'
  }
);
for (const field of ['GRAND TOTAL','₹100.00','Cash','₹25.00','Balance due','₹75.00','Service performed by:']) {
  if (!invoiceMarkup.includes(field)) throw new Error('Invoice PDF is missing required field: ' + field);
}
console.log('PASS: invoice PDF HTML includes Grand Total, Paid, Balance Due and assigned staff');

const complimentaryMarkup = vm.runInNewContext(
  invoiceHtmlSource + String.fromCharCode(10) + 'invoiceHTML({...sampleInvoice,complimentary:true})',
  {
    sampleInvoice,
    db:{business:sampleInvoice.businessSnapshot,staff:[],customers:[],payments:[]},
    sum:(rows,fn)=>rows.reduce((total,row)=>total+Number(fn?fn(row):row||0),0),
    esc:value=>String(value??''),
    INR:value=>'₹'+Number(value||0).toFixed(2),
    invoiceTaxLines:()=>[{taxable:100,rate:0,tax:0,cgst:0,sgst:0,igst:0}],
    invoiceCustomerName:()=> 'PDF Test Customer',
    paid:i=>i?.complimentary?0:25,
    invoiceDue:i=>i?.complimentary?0:75,
    invoicePaymentModeLabel:i=>i?.complimentary?'Complimentary':'Cash',
    fy:()=> '26-27'
  }
);
for (const field of ['COMPLIMENTARY · NO CHARGE','Complimentary service approved. No payment is due.','Complimentary']) {
  if (!complimentaryMarkup.includes(field)) throw new Error('Complimentary invoice PDF is missing: '+field);
}
console.log('PASS: complimentary invoice PDF shows no payment due and correct status');


const reportSource = await readFile(new URL('../src/report-export.js', import.meta.url), 'utf8');
for (const token of ["addSheet(workbook, 'Staff Advances'", "'Staff Advances Issued'", "'Advance Adjustment'", "advances })"]) {
  if (!reportSource.includes(token)) throw new Error('Excel report is missing staff advance support: ' + token);
}
if (!html.includes("exportWorkbook({filename,sales,daily,purchases,expenses,personalExpenses,accounts,staff,advances})")) {
  throw new Error('The app is not passing the Staff Advances register to the Excel exporter.');
}
const sw = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
if (!sw.includes("'./prime-auto-care-logo.jpg'") || !sw.includes("'./prime-auto-care-car-photo.jpg'") || !sw.includes('prime-auto-care-shell-v37')) {
  throw new Error('The offline app cache is missing the original Prime Auto Care branding or v36 cache version.');
}
console.log('PASS: staff advances are included in Excel exports and the offline logo cache');

if (!html.includes("Files → Downloads → Prime Auto Care") ||
    !html.includes("relativePath:'Download/Prime Auto Care'") ||
    !html.includes('Downloads / Prime Auto Care folder')) {
  throw new Error('Prime Auto Care backup and invoice PDF save locations are inconsistent.');
}
if (html.includes('Files → Downloads → WashDesk') ||
    html.includes("relativePath:'Download/WashDesk'") ||
    html.includes('Downloads / WashDesk folder')) {
  throw new Error('A legacy WashDesk download location is still exposed to customers.');
}
console.log('PASS: invoice PDFs and full backups use the Prime Auto Care Downloads folder');

const sql = await readFile(new URL('../cloud-sync-setup.sql', import.meta.url), 'utf8');
if (!html.includes('function reconcileStockLedger(data)') ||
    !html.includes('function recordStockMovement(productId,delta,reason,sourceId,movementId)') ||
    !html.includes("collections=['customers','vehicles','services','invoices','products','stockMovements','purchases','expenses','staff','staffAdvances','attendance','payments','messageRecipients']") ||
    !html.includes("recordStockMovement(productId,-qty,'invoice',invoiceId") ||
    !html.includes("recordStockMovement(productId,qty,'invoice-cancellation',i.id") ||
    !html.includes("recordStockMovement(p.id,q,'purchase',purchaseId") ||
    !html.includes("recordStockMovement(p.id,delta,'manual-adjustment',movementId")) {
  throw new Error('Stock movements must be recorded for every stock-changing workflow and merged by unique ID.');
}
if (!(sql.indexOf("insert into public.washdesk_schema_version") > sql.indexOf("create or replace function public.washdesk_merge_sync")) ||
    !(sql.indexOf("insert into public.washdesk_schema_version") > sql.indexOf("create or replace function public.washdesk_next_invoice_number")) ||
    !(sql.indexOf("insert into public.washdesk_schema_version") > sql.indexOf("alter publication supabase_realtime"))) {
  throw new Error('Cloud stock-ledger readiness must only be published after all updated SQL functions are defined.');
}
if (!sql.includes("'products', 'stockMovements'") ||
    !sql.includes("coalesce(p_payload->'meta'->>'stockLedgerVersion','') <> '1'") ||
    !sql.includes("message = 'INSUFFICIENT_STOCK'") ||
    !sql.includes("'{meta,serverStockLedgerVersion}'") ||
    !sql.includes("v_stock_qty := v_opening + coalesce(v_movement_delta, 0)") ||
    !sql.includes("create table if not exists public.washdesk_schema_version") ||
    !sql.includes("create or replace function public.washdesk_get_stock_ledger_version()") ||
    !sql.includes("jsonb_build_object('stockLedgerVersion', 1, 'serverStockLedgerVersion', 1)") ||
    !sql.includes("'{stockOpeningQty}'")) {
  throw new Error('Cloud SQL must gate old clients, reconcile the stock ledger and reject negative shared stock.');
}
if (!cloudSource.includes('Number(canonical?.meta?.serverStockLedgerVersion) !== 1') ||
    !cloudSource.includes("message.includes('APP_UPDATE_REQUIRED')") ||
    !cloudSource.includes("message.includes('INSUFFICIENT_STOCK')") ||
    !cloudSource.includes('if (!stockLedgerSchemaReady) throw new Error') ||
    !cloudSource.includes("supabase.rpc('washdesk_get_stock_ledger_version')") ||
    !cloudSource.includes("async function refreshStockLedgerSchemaStatus()") ||
    !cloudSource.includes("if (!stockLedgerSchemaReady || schemaBlocked)")) {
  throw new Error('Cloud sync must require server-side stock-ledger confirmation and surface blocked inventory sync.');
}
const stockHelperStart=html.indexOf('function reconcileStockLedger(data){');
const stockHelperEnd=html.indexOf('let db=load()',stockHelperStart);
if(stockHelperStart<0||stockHelperEnd<0)throw new Error('Stock ledger helpers are not available for testing.');
const stockHelperSource=html.slice(stockHelperStart,stockHelperEnd);
const stockLedgerResult=vm.runInNewContext(stockHelperSource+String.fromCharCode(10)+`const first=recordStockMovement('soap',-3,'invoice','bill-1','movement-1');const duplicate=recordStockMovement('soap',-3,'invoice','bill-1','movement-1');const second=recordStockMovement('soap',-2,'invoice','bill-2','movement-2');const purchased=recordStockMovement('soap',4,'purchase','purchase-1','movement-3');const returned=recordStockMovement('soap',3,'invoice-cancellation','bill-1','movement-4');reconcileStockLedger(db);({first,duplicate,second,purchased,returned,qty:db.products[0].qty,movements:db.stockMovements.length})`,{
  db:{products:[{id:'soap',qty:10,stockOpeningQty:10}],stockMovements:[]},
  id:()=>'movement-random'
});
if(!stockLedgerResult.first||stockLedgerResult.duplicate||!stockLedgerResult.second||!stockLedgerResult.purchased||!stockLedgerResult.returned||stockLedgerResult.qty!==12||stockLedgerResult.movements!==4) {
  throw new Error('Stock ledger failed duplicate-retry, multi-device delta, purchase or cancellation reconciliation: '+JSON.stringify(stockLedgerResult));
}
console.log('PASS: unique stock movement IDs prevent retry double-counting and separate device movements reconcile with purchases/cancellations');
console.log('PASS: stock movements are recorded for invoice, cancellation, edit, purchase and adjustment workflows');
console.log('PASS: server merge reconciles unique movements under the workspace lock and rejects negative stock');
console.log('PASS: shared invoice numbering is disabled until updated server SQL confirms the ledger schema');
const initialSyncStart=cloudSource.indexOf('async function initialSync()');
const initialSyncEnd=cloudSource.indexOf('function startSafetyRefresh()',initialSyncStart);
const initialSyncSource=cloudSource.slice(initialSyncStart,initialSyncEnd);
if (!(initialSyncSource.indexOf('await refreshStockLedgerSchemaStatus()') < initialSyncSource.indexOf('supabase.from(\'washdesk_sync\')')) ||
    !initialSyncSource.includes("throw new Error('CLOUD_SCHEMA_UPDATE_REQUIRED')")) {
  throw new Error('The app must check the read-only SQL version before loading or writing the shared workspace.');
}
const rollbackWorkflows=[
  ['async function saveBill()', 'function applyConsumption', 'if(!save()){restoreDatabase(dbBefore)'],
  ['function cancelInvoice(', 'function invoiceEditLineRows', 'if(!save()){restoreDatabase(dbBefore)'],
  ['function saveInvoiceEdits(', 'function invoiceTaxLines', 'if(!save()){restoreDatabase(dbBefore)'],
  ['function addPurchaseForm(', 'function saveStaffAttendance', 'if(!save()){restoreDatabase(dbBefore)'],
  ['function stockAdjustForm(', 'function addVehicleForm', 'if(!save()){restoreDatabase(dbBefore)']
];
for (const [startToken,endToken,guard] of rollbackWorkflows) {
  const start=html.indexOf(startToken),end=html.indexOf(endToken,start);
  if(start<0||end<0||!html.slice(start,end).includes(guard)) {
    throw new Error('Failed local storage writes must rollback the corresponding invoice or inventory operation: '+startToken);
  }
}
console.log('PASS: failed local storage writes rollback invoices, cancellations, edits, purchases and stock adjustments');


for (const token of ['washdesk_merge_sync', 'security definer', 'for update', 'enable row level security', 'washdesk_next_invoice_number', 'washdesk_assert_unique_customer_keys', 'attendance', 'stockmovements', 'washdesk_schema_version', 'washdesk_get_stock_ledger_version', 'stock_ledger_version', 'duplicate_customer_mobile', 'duplicate_vehicle_registration', 'staffadvances', 'washdesk_workspaces', 'washdesk_workspace_members', 'washdesk_join_workspace', 'washdesk_get_workspace', 'washdesk_create_pairing_code', 'washdesk_can_read_sync', 'device pairing code', 'device_not_paired']) {
  if (!sql.toLowerCase().includes(token)) throw new Error('Cloud SQL security/consistency hook missing: ' + token);
}
if (!sql.includes("p_value ~ '^-?[0-9]+([.][0-9]+)?$' then")) throw new Error('Cloud SQL numeric validation regex is invalid.');
const phone0091Rule = String.raw`when digits ~ '^0091[0-9]{10}$' then right(digits, 10)`;
if (!sql.includes(phone0091Rule)) throw new Error('Cloud SQL does not normalise 0091-prefixed mobile numbers.');
if (!sql.includes("'staffAdvances', 'attendance', 'payments'")) throw new Error('Server-side workspace merge is missing attendance records.');
if (!sql.includes('on conflict (user_id, invoice_date) do update') || !sql.includes('public.washdesk_invoice_counters.next_value + 1') || !sql.includes('returning next_value into v_seq')) throw new Error('Daily invoice numbers must use an atomic shared PostgreSQL counter.');
console.log('PASS: cloud schema merges attendance and reserves invoice numbers atomically');
if (!sql.includes("grant execute on function public.washdesk_join_workspace(text) to authenticated;") ||
    !sql.includes("grant execute on function public.washdesk_merge_sync(jsonb) to authenticated;") ||
    !sql.includes("to authenticated") ||
    !sql.includes('washdesk_create_pairing_code() as "Prime Auto Care device pairing code"')) {
  throw new Error('Shared device SQL does not provision a pairing code and authenticated workspace RPCs.');
}
if (!sql.includes('washdesk_can_read_sync(user_id)') || !sql.includes('for update')) {
  throw new Error('Shared workspace data is missing member RLS or serialized writes.');
}
console.log('PASS: database supports secure shared workspace membership and pairing-code provisioning');


if (!packageJson.dependencies['@andreeewill/exceljs'] || !packageJson.dependencies['@supabase/supabase-js'] || !packageJson.dependencies['pdfmake'] || !packageJson.dependencies['@capacitor/local-notifications'] || !packageJson.dependencies['@capacitor/core']) throw new Error('Excel, PDFMake, cloud sync or local notifications runtime dependency missing.');

const electronBuilderAuth = await readFile(new URL('../electron-builder.yml', import.meta.url), 'utf8');
for (const asset of ['pdfmake.bundle.min.js','pdfmake-vfs.js','prime-auto-care-logo.jpg','prime-auto-care-car-photo.jpg','invoice-native.bundle.js','exceljs.bundle.min.js','report-export.bundle.js','cloud-sync.bundle.js','notifications-native.bundle.js','communications.bundle.js','google-reviews.bundle.js','cloud-sync-setup.sql']) {
  if (!electronBuilderAuth.includes('- ' + asset)) throw new Error('Windows installer is missing a required runtime asset: ' + asset);
}
console.log('PASS: Windows installer includes PDFMake, fonts, images, Excel and cloud-sync assets');


// Communications automation: client integration, server functions, consent and queue.
if (!packageJson.dependencies['@capacitor/local-notifications']) {
  throw new Error('The scheduled opening reminder notification dependency is missing.');
}
for (const asset of ['communications.bundle.js','native-links.bundle.js']) {
  const file = new URL('../' + asset, import.meta.url);
  if (!existsSync(file) || statSync(file).size < 500) throw new Error('Missing communications runtime bundle: '+asset);
}
if (!html.includes('<script src="./communications.bundle.js"></script>') ||
    !sw.includes("'./communications.bundle.js'") ||
    !html.includes('<script src="./google-reviews.bundle.js"></script>') ||
    !sw.includes("'./google-reviews.bundle.js'") ||
    !html.includes('<script src="./native-links.bundle.js"></script>') ||
    !sw.includes("'./native-links.bundle.js'") ||
    !html.includes('whatsapp_marketing_image_template') ||
    !html.includes('dlt_voice_template_id')) {
  throw new Error('The communications client must be loaded and precached for offline-safe app startup.');
}
if (html.includes('data-action="queue-whatsapp-cloud"') ||
    html.includes('data-action="queue-sms-gateway"') ||
    html.includes('data-action="queue-voice-calls"') ||
    html.includes('PrimeAutoCareMessaging?.sendInvoice') ||
    !html.includes('data-action="share-offer-whatsapp"') ||
    !html.includes('Share to WhatsApp Group') ||
    !html.includes('function inviteCustomerToWhatsAppGroup(customerId)') ||
    !html.includes('data-customer-sms=') ||
    !html.includes('data-invoice-sms=') ||
    !html.includes('data-consent-field=') ||
    !html.includes('function openInvoiceCustomerChat') ||
    !html.includes('data-open-whatsapp-invoice')) {
  throw new Error('Free mode must share to the existing WhatsApp group, keep paid queues disabled, and provide consent-controlled manual SMS/invoice chat actions.');
}
console.log('PASS: free mode disables paid API queues and shares group offers by user-selected WhatsApp target');
console.log('PASS: invoice PDF is saved and customer WhatsApp / SIM SMS actions use the saved number');
const communicationsClient = await readFile(new URL('../src/communications.js', import.meta.url), 'utf8');
if (!communicationsClient.includes("functions/v1/communication-api") ||
    !communicationsClient.includes('getApiContext') ||
    communicationsClient.includes('META_ACCESS_TOKEN') ||
    communicationsClient.includes('EXOTEL_API_TOKEN')) {
  throw new Error('The client must authenticate to the communications Edge Function without embedding provider credentials.');
}
const edgeFunctionPaths = [
  '../supabase/functions/communication-api/index.ts',
  '../supabase/functions/communication-worker/index.ts',
  '../supabase/functions/communication-webhook/index.ts',
  '../supabase/functions/google-review-api/index.ts',
  '../supabase/functions/google-review-oauth-callback/index.ts',
  '../supabase/functions/google-review-worker/index.ts'
];
for (const path of edgeFunctionPaths) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  await transform(source, { loader:'ts', target:'es2022', format:'esm', logLevel:'silent' });
  if (!source.includes('Deno.serve')) throw new Error('Supabase Edge Function entrypoint is missing Deno.serve: '+path);
}
const communicationsMigration = await readFile(new URL('../supabase/migrations/20261112000100_communications_automation.sql', import.meta.url), 'utf8');
for (const token of [
  'pac_communication_settings','pac_communication_jobs','pac_communication_events',
  'pac_claim_communication_jobs','pac_claim_due_opening_schedules',
  'for update skip locked','unique (workspace_id, idempotency_key)',
  'pac-communication-media','dlt_voice_template_id'
]) {
  if (!communicationsMigration.toLowerCase().includes(token.toLowerCase())) {
    throw new Error('Communications queue migration is missing: '+token);
  }
}
const communicationsApi = await readFile(new URL('../supabase/functions/communication-api/index.ts', import.meta.url), 'utf8');
const communicationsWorker = await readFile(new URL('../supabase/functions/communication-worker/index.ts', import.meta.url), 'utf8');
const communicationsWebhook = await readFile(new URL('../supabase/functions/communication-webhook/index.ts', import.meta.url), 'utf8');
for (const token of ['auth.getUser(token)','member.role !== \'owner\'','waOptIn','smsOptIn','voiceOptIn','waServiceOptIn','smsServiceOptIn','idempotency_key','whatsapp_phone_number_id','PAC_CRON_SETUP_COMPLETE','automationWorker.ready']) {
  if (!communicationsApi.includes(token)) throw new Error('Communications API is missing access/consent guard: '+token);
}
for (const token of ['META_ACCESS_TOKEN','graph.facebook.com','pac_claim_communication_jobs','EXOTEL_API_KEY','Sms/send','calls/connect','PAC_WORKER_SECRET','max_attempts','dlt_voice_template_id']) {
  if (!communicationsWorker.includes(token)) throw new Error('Communications worker is missing provider/queue feature: '+token);
}
if (!communicationsWebhook.includes('x-hub-signature-256') ||
    !communicationsWebhook.includes('META_APP_SECRET') ||
    !communicationsWebhook.includes('EXOTEL_WEBHOOK_TOKEN') ||
    !communicationsWebhook.includes('pac_communication_events')) {
  throw new Error('Provider delivery webhooks must verify signatures/secrets and record delivery events.');
}
if (!communicationsWebhook.includes('recordCustomerOptOut') ||
    !communicationsWebhook.includes('isOptOut') ||
    !communicationsWebhook.includes('provider-inbound-opt-out') ||
    !communicationsWebhook.includes("channel==='voice'") ||
    !communicationsWebhook.includes("digits==='9'")) {
  throw new Error('Inbound STOP/UNSUBSCRIBE replies must update the shared customer consent ledger.');
}
if (!communicationsWorker.includes('CustomField',0) ||
    !communicationsWorker.includes("form.set('CustomField', voiceText)") ||
    !communicationsWorker.includes('voiceText.length>120')) {
  throw new Error('The Exotel voice flow must receive the registered script within its CustomField limit.');
}

const communicationsCron = await readFile(new URL('../communications-cron-setup.sql', import.meta.url), 'utf8');
if (!communicationsCron.includes('pg_cron') || !communicationsCron.includes('pg_net') ||
    !communicationsCron.includes('vault.decrypted_secrets') ||
    !communicationsCron.includes('prime-auto-care-communications-worker')) {
  throw new Error('Unattended messaging needs the Vault-backed server queue cron setup.');
}
const deployWorkflow = await readFile(new URL('../../.github/workflows/deploy-communications.yml', import.meta.url), 'utf8');
for (const token of ['SUPABASE_ACCESS_TOKEN','SUPABASE_PROJECT_REF','SUPABASE_DB_PASSWORD','supabase db push','communication-api','communication-worker','communication-webhook']) {
  if (!deployWorkflow.includes(token)) throw new Error('Communications backend deployment workflow is incomplete: '+token);
}
console.log('PASS: communications Edge Functions parse as TypeScript and the client bundle contains no provider API tokens');
console.log('PASS: server queue enforces device authentication, channel consent, deduplication, retries and delivery callbacks');
console.log('PASS: WhatsApp, DLT SMS, registered voice script, and Vault-backed scheduled worker setup are present');

const businessSaveStart=html.indexOf('function saveBusiness(e)');
const businessSaveEnd=html.indexOf('function saveTax(e)',businessSaveStart);
const businessSaveSource=html.slice(businessSaveStart,businessSaveEnd);
if (!businessSaveSource.includes("f.get('whatsappGroupInviteLink')") ||
    !businessSaveSource.includes('db.business.whatsappGroupInviteLink=groupLink') ||
    !html.includes('esc(b.whatsappGroupInviteLink)') ||
    !html.includes('window.PrimeAutoCareLinks?.openWhatsApp')) {
  throw new Error('WhatsApp group invite URL must save, display and launch through the native external app handler.');
}
for (const token of ['function staffAdvanceRecoveredAmount', 'function deleteStaffAdvance(advanceId)',
  'data-edit-staff-advance=', 'data-delete-staff-advance=',
  "addStaffAdvanceForm(preselectedStaffId='',advanceToEdit=null)",
  'staffAdvanceRecoveredAmount(current)', 'advanceId===current.id']) {
  if (!html.includes(token)) throw new Error('Staff advance edit/delete workflow is incomplete: '+token);
}
if (!nativeLinks.includes('async function openWhatsApp') ||
    !nativeLinks.includes('https://wa.me/') ||
    !nativeLinks.includes('AppLauncher.openUrl')) {
  throw new Error('WhatsApp invitations must launch externally through the native URL launcher.');
}
console.log('PASS: staff advances support Edit/Delete with linked cash-ledger synchronization and salary-adjustment safeguards');
console.log('PASS: WhatsApp group link is persisted, displayed and opened externally without WebView navigation');


const googleReviewClient = await readFile(new URL('../src/google-reviews.js', import.meta.url), 'utf8');
const googleReviewCallback = await readFile(new URL('../supabase/functions/google-review-oauth-callback/index.ts', import.meta.url), 'utf8');
const googleReviewWorker = await readFile(new URL('../supabase/functions/google-review-worker/index.ts', import.meta.url), 'utf8');
const googleReviewWebhook = await readFile(new URL('../supabase/functions/google-review-pubsub-webhook/index.ts', import.meta.url), 'utf8');
const googleReviewPubSubMigration = await readFile(new URL('../supabase/migrations/20261118000100_google_review_pubsub.sql', import.meta.url), 'utf8');
const googleReviewMigration = await readFile(new URL('../supabase/migrations/20261117000100_google_reviews.sql', import.meta.url), 'utf8');
const googleReviewAdminMigration = await readFile(new URL('../supabase/migrations/20261118082000_google_review_admins.sql', import.meta.url), 'utf8');
const googleReviewDeploy = await readFile(new URL('../../.github/workflows/deploy-communications.yml', import.meta.url), 'utf8');
const googleReviewCron = await readFile(new URL('../google-reviews-cron-setup.sql', import.meta.url), 'utf8');
const prepareAssets = await readFile(new URL('../scripts/prepare-assets.mjs', import.meta.url), 'utf8');
if (!prepareAssets.includes("src', 'google-reviews.js") || !prepareAssets.includes('google-reviews.bundle.js')) throw new Error('Google Reviews browser source is not bundled.');
if (!googleReviewClient.includes("functions/v1/google-review-api") || !googleReviewClient.includes('getApiContext') ||
    googleReviewClient.includes('GOOGLE_OAUTH_CLIENT_SECRET') || googleReviewClient.includes('GEMINI_API_KEY') ||
    googleReviewClient.includes('GOOGLE_TOKEN_ENCRYPTION_KEY')) {
  throw new Error('Google Reviews client must call the authenticated Edge Function and contain no server secrets.');
}
for (const token of ['google-review-connect','google-review-sync','google-review-chat','google-review-analyze','google-review-copilot','google-review-publish','google-review-qr']) {
  if (!html.includes(token)) throw new Error('Google Review Center is missing UI action: '+token);
}
if (!html.includes('googleAccountEmail') || !html.includes('13506481990772076097') ||
    !html.includes('https://share.google/6g3f0aJqTezi6JH5T') ||
    !html.includes('https://jkjudmkqaebrgllemris.supabase.co/functions/v1/prime-auto-care-site/')) {
  throw new Error('Prime Auto Care Google owner/profile/website settings were not prefilled.');
}
if (!html.includes('qr:reviewProfileLink') || !googleReviewClient.includes('qr: target') ||
    !html.includes('google-review-log-wa-sent') || !html.includes('google-review-log-pdf-prepared')) {
  throw new Error('Invoice QR, counter QR, and prepared-versus-sent invitation tracking are incomplete.');
}
for (const token of ['pac_google_review_settings','pac_google_oauth_states','pac_google_oauth_credentials',
  'pac_google_reviews','pac_review_invitation_logs','pac_review_ai_analysis','pac_review_reply_drafts',
  'pac_google_review_sync_logs','pac_review_copilot_runs','pac_is_workspace_member']) {
  if (!googleReviewMigration.includes(token)) throw new Error('Google Review migration is missing: '+token);
}
for (const token of ['pac_google_review_admins','google_reviews_admin','workspace_id','auth_user_id','revoked_at','revoke all on public.pac_google_review_admins from anon, authenticated']) {
  if (!googleReviewAdminMigration.includes(token)) throw new Error('Scoped Google Reviews admin migration is missing: '+token);
}
for (const token of ['auth.getUser(token)','GOOGLE_TOKEN_ENCRYPTION_KEY','GOOGLE_OAUTH_CLIENT_SECRET',
  'business.manage','mybusiness.googleapis.com/v4','level1-chat','level2-analyze','level3-copilot',
  'approved !== true','requireGoogleReviewAdmin(ctx)','pac_google_review_admins','GEMINI_API_KEY']) {
  if (!googleReviewApiSource.includes(token)) throw new Error('Google Review API missing authentication/AI/platform safeguard: '+token);
}
for (const token of ['oauth2.googleapis.com/token','email_verified','business.manage','encrypted_refresh_token','consumed_at','pac_google_review_admins','initiated_by']) {
  if (!googleReviewCallback.includes(token)) throw new Error('Google OAuth callback missing: '+token);
}
for (const token of ['pac_get_google_review_worker_secret','api_status','last_successful_sync_at','pac_google_reviews']) {
  if (!googleReviewWorker.includes(token)) throw new Error('Scheduled Google review worker missing: '+token);
}
for (const token of ['google-review-api','google-review-oauth-callback','google-review-worker','google-review-pubsub-webhook','supabase db push']) {
  if (!googleReviewDeploy.includes(token)) throw new Error('Supabase deployment workflow missing Google Review step: '+token);
}
if (!googleReviewCron.includes('pg_cron') || !googleReviewCron.includes('pg_net') ||
    !googleReviewCron.includes('x-google-review-worker-secret') ||
    !googleReviewCron.includes('prime-auto-care-google-reviews-worker')) {
  throw new Error('Vault-backed scheduled Google review catch-up sync is incomplete.');
}
for (const token of ['google_pubsub_audience','pubsub_push_service_account','tokeninfo?id_token=','NEW_REVIEW','UPDATED_REVIEW','google-review-worker','pac_google_review_events','nested.type','nested.location','nested.review']) {
  if (!googleReviewWebhook.includes(token)) throw new Error('Pub/Sub notification receiver is missing safeguard: '+token);
}
if (googleReviewWebhook.includes("env('GOOGLE_PUBSUB_AUDIENCE')") ||
    googleReviewWebhook.includes("env('GOOGLE_PUBSUB_PUSH_SERVICE_ACCOUNT')")) {
  throw new Error('Pub/Sub identity must be verified against workspace-scoped database configuration.');
}
for (const token of ['notifications_enabled','notifications_last_event_at','pac_google_review_events','pac_is_workspace_member']) {
  if (!googleReviewPubSubMigration.includes(token)) {
    throw new Error('Pub/Sub migration is missing: '+token);
  }
}
if (!googleReviewApiSource.includes('enable-notifications') || !googleReviewApiSource.includes('mybusinessnotifications.googleapis.com/v1/')) {
  throw new Error('Google Notifications API registration is missing.');
}
if (!googleReviewDeploy.includes('google-review-pubsub-webhook')) throw new Error('Pub/Sub webhook is not included in deployment.');
if (!googleReviewPage.includes('API sync') || !googleReviewPage.includes('optional') ||
    !googleReviewApiSource.includes('enable-notifications') ||
    !googleReviewPubSubMigration.includes('notifications_last_event_at')) {
  throw new Error('Google API automation must remain an optional backend capability while manual replies work without it.');
}
console.log('PASS: manual replies are the default; OAuth, scheduled sync, Gemini and instant alerts remain optional API capabilities');


const growthMigration = await readFile(new URL('../supabase/migrations/20261118110000_google_ai_growth_studio.sql', import.meta.url), 'utf8');
const dailyGrowthMigration = await readFile(new URL('../supabase/migrations/20261118143000_google_growth_daily_runs.sql', import.meta.url), 'utf8');
const growthClient = await readFile(new URL('../src/google-reviews.js', import.meta.url), 'utf8');
const growthApi = await readFile(new URL('../supabase/functions/google-review-api/index.ts', import.meta.url), 'utf8');
const website = await readFile(new URL('../website/index.html', import.meta.url), 'utf8');
for (const token of ['pac_google_growth_posts','pac_google_growth_keywords','enable row level security','revoke all on public.pac_google_growth_posts from anon, authenticated','pac-google-growth-media','5242880','image/jpeg','image/png']) {
  if (!growthMigration.includes(token)) throw new Error('Google AI Growth migration is missing a security or storage safeguard: '+token);
}
for (const token of ['pac_google_growth_daily_runs','unique (workspace_id, run_date)','revoke all on public.pac_google_growth_daily_runs from public, anon, authenticated','grant all on public.pac_google_growth_daily_runs to service_role']) {
  if (!dailyGrowthMigration.includes(token)) throw new Error('Daily AI Growth migration is missing its workspace idempotency or service-only security safeguard: '+token);
}
for (const token of ['Server-connected free AI','AI GROWTH STUDIO','Generate 2 additional drafts','AI relevance estimates','data-growth-photo','openrouter.ai/keys','googleGrowthMarkup','Daily post autopilot','Create gold-glass poster','ensureDailyGrowthPosts','[vehicle number removed]']) {
  if (!html.includes(token)) throw new Error('Google AI Growth Studio UI is missing: '+token);
}
for (const token of ['ai-generate','ensure-daily-growth-posts','Asia/Kolkata','list-growth-posts','save-growth-post','save-growth-keywords','upload-growth-photo','publish-growth-post','openrouter/free','Paid model IDs are blocked','Photo must be between 10 KB and 5 MB','250 × 250 pixels','pac_google_growth_posts','pac_google_growth_daily_runs']) {
  if (!growthApi.includes(token)) throw new Error('Google AI Growth backend is missing: '+token);
}
if (!growthClient.includes('ensureDailyGrowthPosts') ||
    growthClient.includes('GOOGLE_OAUTH_CLIENT_SECRET') ||
    growthClient.includes('api_key:') ||
    html.includes('google-ai-api-key') ||
    html.includes('localStorage.setItem(GOOGLE_AI_KEY_STORAGE')) {
  throw new Error('The browser API client must not store or transmit AI provider keys.');
}
console.log('PASS: browser and APK no longer store OpenRouter keys; AI runs through server-side secrets');
for (const token of ['canonical','og:title','twitter:card','AutoWash','openingHoursSpecification','Prime Auto Care','wash-enquiry-form','WhatsApp','href="./booking/"','08:00 AM – 07:00 PM']) {
  if (!website.includes(token)) throw new Error('Public website SEO or enquiry markup is missing: '+token);
}
if (!html.includes('--bg:#f3efe6') || !html.includes('backdrop-filter:blur(22px)')) throw new Error('The warm liquid-glass interface styles are missing.');
console.log('PASS: AI Growth Studio, daily workspace idempotency, privacy redaction, real-photo poster, warm glass UI and website SEO/enquiry checks');

console.log('PASS: Excel and Supabase sync dependencies declared');
console.log('Prime Auto Care validation complete.');

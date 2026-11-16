import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const OPENING_REMINDER_ID = 725401;
const TEST_REMINDER_ID = 725402;
const CHANNEL_ID = 'prime-auto-care-opening-reminder';
const INDIA_TIME_ZONE = 'Asia/Kolkata';
const INDIA_OFFSET = 330;
let listenerRegistered = false;

function indiaParts(now = new Date()) {
  const shifted = new Date(now.getTime() + INDIA_OFFSET * 60000);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() };
}
function nextIndiaTime(time = '07:50', now = new Date()) {
  const match = String(time).match(/^([0-9]{2}):([0-9]{2})$/);
  if (!match) throw new Error('Choose a valid reminder time.');
  const parts = indiaParts(now);
  let utc = Date.UTC(parts.year, parts.month, parts.day, Number(match[1]), Number(match[2])) - INDIA_OFFSET * 60000;
  if (utc <= now.getTime()) utc += 86400000;
  return new Date(utc);
}
function deviceTimeForIndia(time = '07:50', now = new Date()) {
  const [hour, minute] = String(time).split(':').map(Number);
  const offset = -now.getTimezoneOffset();
  const total = ((hour * 60 + minute + offset - INDIA_OFFSET) % 1440 + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}
function displayIndiaTime(date) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: INDIA_TIME_ZONE, weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }).format(date) + ' IST';
}
async function registerListeners() {
  if (listenerRegistered || !Capacitor.isNativePlatform()) return;
  listenerRegistered = true;
  await LocalNotifications.addListener('localNotificationActionPerformed', action => {
    if (action?.notification?.extra?.action === 'openingAnnouncement') window.dispatchEvent(new CustomEvent('prime-auto-care-opening-reminder'));
  });
  await LocalNotifications.addListener('localNotificationReceived', notification => {
    if (notification?.id === OPENING_REMINDER_ID) window.dispatchEvent(new CustomEvent('prime-auto-care-opening-reminder-received'));
  });
}
async function ensureChannel() {
  try {
    await LocalNotifications.createChannel({ id: CHANNEL_ID, name: 'Opening announcement reminder', description: 'Daily reminder to prepare the Prime Auto Care opening announcement', importance: 4 });
  } catch (error) {
    if (!String(error?.message || '').toLowerCase().includes('already')) throw error;
  }
}
export async function getReminderStatus({ enabled = true, time = '07:50' } = {}) {
  if (!Capacitor.isNativePlatform()) return { supported: false, enabled: false };
  const permission = await LocalNotifications.checkPermissions();
  const pending = await LocalNotifications.getPending();
  const scheduled = (pending?.notifications || []).some(item => item.id === OPENING_REMINDER_ID);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown';
  return { supported: true, enabled: !!enabled && scheduled && permission.display === 'granted', scheduled, permissionDenied: permission.display !== 'granted', timezone, timezoneMatchesIndia: timezone === INDIA_TIME_ZONE, nextRun: displayIndiaTime(nextIndiaTime(time)), exactTime: '07:50 AM Asia/Kolkata' };
}
export async function sendTestNotification() {
  if (!Capacitor.isNativePlatform()) return { supported: false };
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') return { supported: true, permissionDenied: true };
  await ensureChannel();
  await LocalNotifications.cancel({ notifications: [{ id: TEST_REMINDER_ID }] });
  await LocalNotifications.schedule({ notifications: [{ id: TEST_REMINDER_ID, title: 'Prime Auto Care · Test notification', body: 'Your phone can display Prime Auto Care notifications.', channelId: CHANNEL_ID, schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, autoCancel: true, extra: { action: 'testNotification' } }] });
  return { supported: true, scheduled: true };
}
export async function scheduleOpeningReminder({ enabled, time = '07:50', businessName, openingTime, closingTime, address, phone, requestPermission = true }) {
  if (!Capacitor.isNativePlatform()) return { supported: false, enabled: false };
  await LocalNotifications.cancel({ notifications: [{ id: OPENING_REMINDER_ID }] });
  if (!enabled) return { supported: true, enabled: false, timezone: INDIA_TIME_ZONE };
  const match = String(time || '07:50').match(/^([0-9]{2}):([0-9]{2})$/);
  if (!match) throw new Error('Choose a valid daily reminder time.');
  if (Number(match[1]) > 23 || Number(match[2]) > 59) throw new Error('Choose a valid daily reminder time.');
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted' && requestPermission) permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') return { supported: true, enabled: false, permissionDenied: true };
  await registerListeners(); await ensureChannel();
  const local = deviceTimeForIndia(match[1] + ':' + match[2]);
  const business = String(businessName || 'Prime Auto Care');
  const hours = openingTime && closingTime ? "Today's hours: " + openingTime + '–' + closingTime + '.' : 'Prepare today’s opening announcement.';
  const place = address ? ' Location: ' + address + '.' : '', contact = phone ? ' Contact: ' + phone + '.' : '';
  await LocalNotifications.schedule({ notifications: [{
    id: OPENING_REMINDER_ID, title: business + ' · Opening announcement',
    body: hours + place + contact + ' Tap to prepare and share the message.', channelId: CHANNEL_ID, autoCancel: true,
    extra: { action: 'openingAnnouncement', timeZone: INDIA_TIME_ZONE, requestedTime: match[1] + ':' + match[2] },
    schedule: { on: { hour: local.hour, minute: local.minute }, allowWhileIdle: true }
  }]});
  return { supported: true, enabled: true, time: match[1] + ':' + match[2], timezone: INDIA_TIME_ZONE, deviceTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Unknown', nextRun: displayIndiaTime(nextIndiaTime(time)) };
}
export async function syncOpeningReminderIfPermitted(settings = {}) {
  if (!Capacitor.isNativePlatform()) return { supported: false, enabled: false };
  return scheduleOpeningReminder({ ...settings, requestPermission: false });
}
window.PrimeAutoCareNotifications = { scheduleOpeningReminder, syncOpeningReminderIfPermitted, getReminderStatus, sendTestNotification, isNative: () => Capacitor.isNativePlatform() };

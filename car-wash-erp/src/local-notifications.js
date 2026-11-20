import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const OPENING_REMINDER_ID = 725401;
const TEST_REMINDER_ID = 725402;
const CHANNEL_ID = 'prime-auto-care-opening-reminder';
const BOOKING_ALERT_CHANNEL_ID = 'prime-auto-care-booking-alerts';
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
async function ensureBookingAlertChannel() {
  try {
    await LocalNotifications.createChannel({
      id: BOOKING_ALERT_CHANNEL_ID,
      name: 'Customer booking alerts',
      description: 'New customer and urgent booking requests for Prime Auto Care',
      importance: 5,
      sound: 'default',
      vibration: true
    });
  } catch (error) {
    if (!String(error?.message || '').toLowerCase().includes('already')) throw error;
  }
}
function bookingNotificationId(value) {
  const input = String(value || Date.now());
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2000000000 + 1;
}
export async function requestBookingAlertPermission() {
  if (Capacitor.isNativePlatform()) {
    let permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
    if (permission.display === 'granted') {
      await registerListeners();
      await ensureBookingAlertChannel();
    }
    return {
      supported: true,
      permissionGranted: permission.display === 'granted',
      permissionDenied: permission.display !== 'granted'
    };
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, reason: 'This browser does not support desktop notifications.' };
  }
  let permission = window.Notification.permission;
  if (permission === 'default') permission = await window.Notification.requestPermission();
  return {
    supported: true,
    permissionGranted: permission === 'granted',
    permissionDenied: permission === 'denied'
  };
}
export async function sendBookingAlertNotification(booking = {}) {
  const urgent = booking.is_urgent === true;
  const eventType = String(booking.event_type || 'booking_created');
  const titles = {
    booking_created: urgent ? 'URGENT BOOKING · Prime Auto Care' : 'New booking · Prime Auto Care',
    booking_confirmed: 'BOOKING ACCEPTED · Prime Auto Care',
    booking_rejected: 'BOOKING REJECTED · Prime Auto Care',
    booking_cancelled: 'BOOKING CANCELLED · Prime Auto Care'
  };
  const title = titles[eventType] || 'Booking update · Prime Auto Care';
  const bookingCode = String(booking.booking_code || '').slice(0, 40);
  const customer = String(booking.customer_name || 'Customer').slice(0, 60);
  const vehicle = String(booking.vehicle_number || 'Vehicle').slice(0, 20);
  const service = String(booking.service_type || 'Wash service').slice(0, 40);
  const date = String(booking.booking_date || '').slice(0, 10);
  const time = String(booking.start_time || '').slice(0, 5);
  const actor = String(booking.actor_label || '').slice(0, 60);
  const body = [bookingCode, customer, vehicle, service, date + (time ? ' ' + time : ''), actor ? 'By ' + actor : ''].filter(Boolean).join(' · ').slice(0, 240);
  const id = bookingNotificationId(booking.id || booking.booking_code || (customer + vehicle + date + time));

  if (Capacitor.isNativePlatform()) {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') return { supported: true, permissionRequired: permission.display === 'prompt' || permission.display === 'prompt-with-rationale', permissionDenied: permission.display === 'denied' };
    await registerListeners();
    await ensureBookingAlertChannel();
    await LocalNotifications.schedule({ notifications: [{
      id,
      title,
      body,
      channelId: BOOKING_ALERT_CHANNEL_ID,
      sound: 'default',
      autoCancel: true,
      extra: { action: 'bookingAlert', bookingId: String(booking.booking_id || ''), bookingCode, isUrgent: urgent },
      schedule: { at: new Date(Date.now() + 250), allowWhileIdle: true }
    }]});
    return { supported: true, scheduled: true, id };
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, reason: 'This browser does not support desktop notifications.' };
  }
  if (window.Notification.permission === 'default') return { supported: true, permissionRequired: true };
  if (window.Notification.permission !== 'granted') return { supported: true, permissionDenied: true };

  const notification = new window.Notification(title, {
    body,
    tag: 'prime-auto-care-booking-' + id,
    renotify: true,
    icon: './prime-auto-care-icon-192.png',
    badge: './prime-auto-care-icon-192.png',
    data: { bookingId: String(booking.booking_id || ''), bookingCode }
  });
  notification.onclick = () => {
    try { window.focus(); } catch { /* foregrounding is browser-controlled */ }
    window.dispatchEvent(new CustomEvent('prime-auto-care-booking-notification-open', {
      detail: { bookingId: String(booking.booking_id || ''), bookingCode }
    }));
    notification.close();
  };
  return { supported: true, scheduled: true, id };
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
window.PrimeAutoCareNotifications = { scheduleOpeningReminder, syncOpeningReminderIfPermitted, getReminderStatus, sendTestNotification, requestBookingAlertPermission, sendBookingAlertNotification, isNative: () => Capacitor.isNativePlatform() };

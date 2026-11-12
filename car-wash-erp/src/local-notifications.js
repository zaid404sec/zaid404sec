import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const OPENING_REMINDER_ID = 725401;
const CHANNEL_ID = 'prime-auto-care-opening-reminder';
let listenerRegistered = false;

async function ensureActionListener() {
  if (listenerRegistered || !Capacitor.isNativePlatform()) return;
  listenerRegistered = true;
  await LocalNotifications.addListener('localNotificationActionPerformed', action => {
    if (action?.notification?.extra?.action === 'openingAnnouncement') {
      window.dispatchEvent(new CustomEvent('prime-auto-care-opening-reminder'));
    }
  });
}

export async function scheduleOpeningReminder({ enabled, time, businessName, openingTime, closingTime, address, phone, requestPermission = true }) {
  if (!Capacitor.isNativePlatform()) return { supported: false, enabled: false };
  const notification = { id: OPENING_REMINDER_ID };
  await LocalNotifications.cancel({ notifications: [notification] });
  if (!enabled) return { supported: true, enabled: false };

  const match = String(time || '07:45').match(/^(\d{2}):(\d{2})$/);
  if (!match) throw new Error('Choose a valid daily reminder time.');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new Error('Choose a valid daily reminder time.');

  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted' && requestPermission) {
    permission = await LocalNotifications.requestPermissions();
  }
  if (permission.display !== 'granted') {
    return { supported: true, enabled: false, permissionDenied: true };
  }

  await ensureActionListener();
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Opening announcement reminder',
      description: 'Daily reminder to prepare the Prime Auto Care opening announcement',
      importance: 3
    });
  } catch (error) {
    // Channel creation is Android-only and may already exist on this device.
    if (!String(error?.message || '').toLowerCase().includes('already')) throw error;
  }

  const business = String(businessName || 'Prime Auto Care');
  const hours = openingTime && closingTime ? `Today's hours: ${openingTime}–${closingTime}.` : 'Prepare today’s opening announcement.';
  const place = address ? ` Location: ${address}.` : '';
  const contact = phone ? ` Contact: ${phone}.` : '';
  await LocalNotifications.schedule({
    notifications: [{
      id: OPENING_REMINDER_ID,
      title: `${business} · Opening announcement`,
      body: `${hours}${place}${contact} Tap to prepare and share the message.`,
      channelId: CHANNEL_ID,
      autoCancel: true,
      extra: { action: 'openingAnnouncement' },
      schedule: { on: { hour, minute } }
    }]
  });
  return { supported: true, enabled: true, time: `${match[1]}:${match[2]}` };
}

export async function syncOpeningReminderIfPermitted(settings = {}) {
  if (!Capacitor.isNativePlatform() || !settings.enabled) return { supported: Capacitor.isNativePlatform(), enabled: false };
  return scheduleOpeningReminder({ ...settings, requestPermission: false });
}

window.PrimeAutoCareNotifications = {
  scheduleOpeningReminder,
  syncOpeningReminderIfPermitted,
  isNative: () => Capacitor.isNativePlatform()
};

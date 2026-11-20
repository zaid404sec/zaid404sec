const DEVICE_LABEL_KEY = 'prime-auto-care-booking-device-label-v1';

function bookingDeviceLabel() {
  try {
    return String(localStorage.getItem(DEVICE_LABEL_KEY) || '').trim();
  } catch {
    return '';
  }
}

async function bookingRequest(action, body = {}) {
  const context = await window.WashDeskCloud?.getApiContext?.();
  if (!context?.url || !context?.anonKey || !context?.accessToken) {
    throw new Error('Connect this device to the shared Prime Auto Care cloud before opening Bookings.');
  }
  const response = await fetch(context.url + '/functions/v1/booking-api', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: context.anonKey,
      Authorization: 'Bearer ' + context.accessToken
    },
    body: JSON.stringify({ action, ...body, device_label: bookingDeviceLabel() })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || 'Booking service returned HTTP ' + response.status + '.');
    error.status = response.status;
    throw error;
  }
  return result;
}

window.PrimeAutoCareBookings = {
  list: filters => bookingRequest('list', filters || {}),
  create: booking => bookingRequest('create-staff', { booking }),
  updateStatus: (id, status, statusNote = '') => bookingRequest('update-status', { id, status, status_note: statusNote }),
  saveSettings: settings => bookingRequest('save-settings', { settings }),
  notifications: () => bookingRequest('notifications'),
  acknowledgeNotification: id => bookingRequest('acknowledge-notification', { id }),
  createNotificationPairCode: () => bookingRequest('create-notification-pair-code'),
  redeemNotificationPairCode: code => bookingRequest('redeem-notification-pair-code', { code }),
  revokeNotificationDevice: user_id => bookingRequest('revoke-notification-device', { user_id }),
  setDeviceLabel: label => {
    const clean = String(label || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    if (clean.length < 2) throw new Error('Enter a device name with at least 2 characters.');
    localStorage.setItem(DEVICE_LABEL_KEY, clean);
    return clean;
  },
  setDeviceAccess: (user_id, permissions) => bookingRequest('set-device-access', { user_id, ...permissions }),
  revokeDevice: user_id => bookingRequest('revoke-device', { user_id })
};

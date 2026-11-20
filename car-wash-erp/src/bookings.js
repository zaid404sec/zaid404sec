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
    body: JSON.stringify({ action, ...body })
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
  revokeNotificationDevice: user_id => bookingRequest('revoke-notification-device', { user_id }),
  requestDeviceAccess: (device_label, device_kind) => bookingRequest('request-booking-device-access', { device_label, device_kind }),
  reviewDeviceAccess: (auth_user_id, approved, can_decide_bookings = false) => bookingRequest('review-booking-device-access', { auth_user_id, approved, can_decide_bookings }),
  revokeDeviceAccess: auth_user_id => bookingRequest('revoke-booking-device-access', { auth_user_id })
};

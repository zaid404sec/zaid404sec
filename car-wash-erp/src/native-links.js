import { AppLauncher } from '@capacitor/app-launcher';

function validateTarget(url) {
  const value = String(url || '').trim();
  if (!/^(sms|smsto|https):/i.test(value)) {
    throw new Error('Only SMS and HTTPS links are supported.');
  }
  return value;
}

async function openUrl(url) {
  const target = validateTarget(url);
  try {
    const result = await AppLauncher.openUrl({ url: target });
    return { opened: true, result };
  } catch (error) {
    if (typeof window !== 'undefined' && !/^sms:|^smsto:/i.test(target)) {
      window.open(target, '_blank', 'noopener,noreferrer');
      return { opened: true, fallback: true };
    }
    throw error;
  }
}

window.PrimeAutoCareLinks = { openUrl };

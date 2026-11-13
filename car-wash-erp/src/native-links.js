import { Capacitor } from '@capacitor/core';
import { AppLauncher } from '@capacitor/app-launcher';

function normalizeIndianMobile(value) {
  let digits=String(value||'').replace(/\D/g,'');
  if(digits.length===10)digits='91'+digits;
  else if(digits.length===11&&digits.startsWith('0'))digits='91'+digits.slice(1);
  return digits;
}

async function openSms(phone, body) {
  const digits=normalizeIndianMobile(phone);
  if(digits.length<11)throw new Error('Enter a valid customer mobile number.');
  const message=String(body||'').trim();
  if(!message)throw new Error('The SMS message is empty.');
  if(!Capacitor.isNativePlatform())throw new Error('The SIM-based SMS composer is available in the Android app only.');
  const url='smsto:+'+digits+'?body='+encodeURIComponent(message);
  return AppLauncher.openUrl({url});
}

async function openWhatsApp(phone, body) {
  const digits=normalizeIndianMobile(phone);
  if(digits.length<11)throw new Error('Enter a valid customer mobile number.');
  const message=String(body||'').trim();
  if(!message)throw new Error('The WhatsApp message is empty.');
  const url='https://wa.me/'+digits+'?text='+encodeURIComponent(message);
  if(Capacitor.isNativePlatform())return AppLauncher.openUrl({url});
  window.location.href=url;
}

window.PrimeAutoCareLinks = { openSms, openWhatsApp };

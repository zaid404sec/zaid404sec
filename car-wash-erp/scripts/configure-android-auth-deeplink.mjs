import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const manifestPath = path.resolve('android/app/src/main/AndroidManifest.xml');
let xml = await readFile(manifestPath, 'utf8');
const activityMatch = xml.match(/<activity\\b(?=[^>]*android:name=["']\\.MainActivity["'])[^>]*>[\\s\\S]*?<\\/activity>/);
if (!activityMatch) {
  throw new Error('Could not find the generated Capacitor .MainActivity in AndroidManifest.xml');
}
let activity = activityMatch[0];
const openingTag = activity.match(/^<activity\\b[^>]*>/)?.[0];
if (!openingTag) throw new Error('Could not read the MainActivity opening tag.');
let updatedOpening = openingTag;
if (/android:launchMode=/.test(updatedOpening)) {
  updatedOpening = updatedOpening.replace(/android:launchMode=["'][^"']+["']/, 'android:launchMode="singleTask"');
} else {
  updatedOpening = updatedOpening.replace(/>$/, ' android:launchMode="singleTask">');
}
activity = activity.replace(openingTag, updatedOpening);

const filter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="primeautocare" android:host="auth-callback" />
            </intent-filter>`;
if (!activity.includes('android:scheme="primeautocare"')) {
  activity = activity.replace('</activity>', filter + '\\n        </activity>');
}
xml = xml.replace(activityMatch[0], activity);
await writeFile(manifestPath, xml, 'utf8');

if (!xml.includes('android:scheme="primeautocare"') ||
    !xml.includes('android:host="auth-callback"') ||
    !activity.includes('android:launchMode="singleTask"')) {
  throw new Error('Prime Auto Care email-link deep-link route was not installed correctly.');
}
console.log('PASS: Android MainActivity handles primeautocare://auth-callback email links');

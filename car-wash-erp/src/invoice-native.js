import { Capacitor } from '@capacitor/core';
import { FileSharer } from '@capgo/capacitor-file-sharer';
import { AppLauncher } from '@capacitor/app-launcher';

// Native Android uses the Files provider and system share sheet. Desktop/web
// keep their browser download and URL fallbacks instead of calling native stubs.
const isNative = Capacitor.isNativePlatform();
window.WashDeskFileSharer = isNative ? FileSharer : null;
window.WashDeskAppLauncher = isNative ? AppLauncher : null;

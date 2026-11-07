import { FileSharer } from '@capgo/capacitor-file-sharer';

// Expose the Capacitor-native Android file share/save bridge to the legacy app UI.
window.WashDeskFileSharer = FileSharer;

import { AppLauncher } from '@capacitor/app-launcher';
window.WashDeskAppLauncher = AppLauncher;

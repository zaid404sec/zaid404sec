# Release record — Prime Auto Care 2.8.3

_Verified: 16 November 2026_

## Source

- Repository: https://github.com/zaid404sec/zaid404sec
- Branch: `main`
- Merge commit: `52ac00acd65b251c3497d16a6eb2c69cdb5d5774`
- PR #43: https://github.com/zaid404sec/zaid404sec/pull/43
- Main workflow run #185: https://github.com/zaid404sec/zaid404sec/actions/runs/43873773360

## Changes

- Monthly payroll Net Payable subtracts all remaining open advances. Excess advances now show a negative recovery balance, highlighted in red.
- Separate Staff recovery due total; positive Salary payable does not get offset by negative balances from other staff.
- Salary settlement remains safe: the amount adjusted against salary cannot exceed the available salary balance.
- Individual staff statement dialog, PDF summary, Excel summary, filenames and export confirmation identify the selected employee and date range.
- Regression validation covers ₹2,500 open advances against ₹1,000 earned salary: Net Payable must equal −₹1,500 while the salary adjustment remains capped at ₹1,000.
- App version 2.8.3, Android package ID `com.washdesk.carwash.v20`, service-worker cache v24.

## Build verification

Both required jobs in main workflow run #185 completed successfully:
- Android APK — success.
- Windows EXE installer — success.

The Android pipeline completed asset preparation, `npm run validate`, Capacitor sync, Gradle `assembleDebug` and artifact upload. Windows EXE build and artifact upload completed successfully too.

## APK fingerprint

- GitHub artifact name: `WashDesk-Android-APK`
- Artifact ID: `14227899990`
- Artifact archive SHA-256: `f5962c33e1129d2cdb88cad9a814c77f205833320d3cd8d42ad748ac83361564`
- Delivered APK: `Prime-Auto-Care-2.8.3.apk`
- Size: 6,527,194 bytes.
- APK SHA-256: `e6aa6a4d99fd135d113a813d6793adda2d886384e8a387a69a5605e461787a64`
- Embedded app ID: `com.washdesk.carwash.v20`
- Build type: debug APK.

The Actions artifact ZIP and the extracted APK both passed ZIP integrity verification. The embedded Capacitor config was inspected and matched v20.

## Installation and data warning

The v20 debug APK installs as a separate app beside v19; it is not an in-place upgrade. Keep v19 installed. Its app-local storage is not automatically available to v20. Before using v20 for live business transactions, connect it to the same shared cloud workspace and verify all records, or export a JSON backup from v19 and restore it in v20. Do not uninstall v19 or clear its data until the new app is checked.

## Physical device caveat

CI did not test the owner's physical Android device. Notification delivery after reboot / battery restrictions, native sharing and cloud sync transitions still need handset acceptance testing.

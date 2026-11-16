# Release record — Prime Auto Care 2.8.2

_Verified: 16 November 2026_

## Source

- Repository: https://github.com/zaid404sec/zaid404sec
- Branch: `main`
- Merge commit: `1f6d243db00ee35ab46d4a652ca29d82942f2c94`
- PR #40: https://github.com/zaid404sec/zaid404sec/pull/40
- Workflow run #181: https://github.com/zaid404sec/zaid404sec/actions/runs/43867694662
- Artifact name: `WashDesk-Android-APK`
- Artifact ID: `14226003280`

## Build verification

Both required jobs completed successfully:
- Android APK — success.
- Windows EXE installer — success.

Android steps included application validation, Capacitor asset preparation/sync, Gradle `assembleDebug` and APK upload. Windows EXE installer build and artifact upload also succeeded.

## APK fingerprint

- File name delivered: `Prime-Auto-Care-2.8.2.apk`
- Size: 6,526,694 bytes.
- SHA-256: `f9c7b7ef216448d021560ab8045b2f5f65776ab0a46fc7b998fb93931648c712`
- Embedded app ID: `com.washdesk.carwash.v19`
- Build type: debug APK.

The APK archive passed ZIP integrity verification. Its embedded Capacitor metadata was inspected and matched the v19 application ID.

The Actions artifact archive SHA-256 was recorded as:
`fbb9d364b2ba3484ec290289a2e54e4b21163ba94f89844b998890b43b7524a5`.

## Installation caution

This APK installs as the separate v19 app; it is not an in-place upgrade of v18. Keep the previous app installed until cloud sync or JSON backup restore is confirmed and all important records are checked in v19.

Do not infer data migration from the version number or successful APK installation.

## Physical device caveat

CI did not test a real Android phone. Notification delivery through reboot / battery restrictions, permission edge cases, real native sharing and real cloud sync still require handset acceptance testing.

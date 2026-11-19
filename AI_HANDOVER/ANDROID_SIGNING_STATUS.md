# Android signing status — 20 November 2026

## Verified APK certificate comparison
- Existing 2.11.0 APK certificate SHA-256: `dcc0d72b55241ae6ef20de36ddcff3c95b7a44c0ff0b17a61acb0da15d2704ce`.
- Final 2.13.1 APK from run #445972 certificate SHA-256: `aabb892f62856c530540c950524f6176769b4da6228862862b7a0779c0504a8c`.
- These do not match. The 2.13.1 build is debug-signed on a fresh GitHub runner; each runner may generate a different certificate, so there is no stable release identity.
- Android will reject the tested 2.13.1 APK as an in-place update over the existing 2.11.0/v24 installation, despite the same package ID `com.washdesk.carwash.v24` and a higher version code.

## Signing-key availability
- No original Android `.jks` / `.keystore` or signing password was found in the current conversation files or Library search.
- The CI currently builds `assembleDebug` on a fresh GitHub runner, which generates/uses that runner's debug key. It is a test APK, not a production-signed upgrade.
- The private signing key cannot be recovered from the APK certificate. Do not claim the new APK is installable as an update.

## Safe release procedure
1. If the original signing keystore still exists, configure it as GitHub Actions secrets (for example, base64 keystore, keystore password, key alias and key password). Never commit the keystore or paste its passwords into chat.
2. Configure the Android release signing block in Gradle and build `assembleRelease` using that original key.
3. Compare the release APK certificate fingerprint against the installed app's original fingerprint before distributing it.
4. If the original key is permanently lost, a new key requires an explicit migration decision: export/backup app data, plan a clean uninstall/reinstall or a new application ID, and re-pair devices. Do not silently replace the installed app.

The current 2.13.1 APK is suitable for testing on a spare device. Do not install it over the current v24 app.

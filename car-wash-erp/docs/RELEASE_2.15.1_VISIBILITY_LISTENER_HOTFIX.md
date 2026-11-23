# Prime Auto Care 2.15.1 — cloud listener hotfix

This is a targeted hotfix for the 2.15.0 Owner-login startup error:

`ReferenceError: visibilityReconcileListener is not defined`

## Fix
- Declares `visibilityReconcileListener` at module scope in `src/cloud-sync.js`, initialized to `null`.
- `startSafetyRefresh()` can now safely remove and replace its single `visibilitychange` handler after Owner authentication and initial cloud sync.
- The existing two-minute `updated_at`-only reconciliation and Realtime-first sync behaviour remain unchanged.
- Adds a validator assertion so a future build fails before packaging if the listener declaration is removed.

## Installability
- Package version: `2.15.1`
- Android application ID: `com.washdesk.carwash.v34`
- Offline cache: `prime-auto-care-shell-v38`
- This is a side-by-side installation. Keep the previous APK installed and back up records before testing.

## Validation
The GitHub Actions release pipeline must pass application validation, Android packaging, Windows installer packaging, backend type checks and full source/handover/release packaging. Real-device Owner login and multi-device sync still need a device test.

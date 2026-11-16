# Safe change and release rules

These rules are mandatory for every future AI working on Prime Auto Care.

## 1. Protect production business data

- Treat customer, vehicle, invoice, payment, stock, purchase, expense, staff, attendance, payroll, advance, backup and cloud records as irreplaceable.
- Never use destructive commands or SQL such as `DROP`, `TRUNCATE`, broad `DELETE`, database reset, table recreation or destructive reseeding against an existing workspace.
- Never replace the existing Supabase project or ask the owner to create a new one just to ship a feature.
- Keep existing primary keys / IDs and data relationships. Do not break invoice numbering, payment ledgers, staff advance adjustments, stock movements or cloud conflict resolution.
- Prefer additive, backward-compatible migrations. Existing app versions and older stored records may still exist on phones.
- Do not rerun one-time database setup SQL on a live workspace unless the current setup instructions explicitly say that action is safe.
- Do not expose pairing codes, Supabase keys, access tokens, passwords or other secrets in code, public issues, build logs, screenshots, documentation or chat.

## 2. Preserve existing app behavior

- Start from the latest `main` branch and inspect the live source.
- Make a focused, minimal diff. Do not replace the large main `index.html` file with a new app template.
- Preserve invoices/PDFs, customer search, vehicle categories, payments, inventory, purchases, expenses, staff attendance/payroll/advances, date-based reports, dashboard analytics, backups, offline support, native sharing and cloud sync.
- Maintain existing branding and responsive mobile layout unless the owner asks for a redesign.
- Update service-worker cache versions when relevant cached files change.
- Extend automated validation for new business calculations and important state transitions.
- Avoid adding dependencies unless they materially solve the requested problem.

## 3. Required development workflow

1. Confirm current `main` commit and read app version, app ID, latest PRs and build status.
2. Create a focused feature branch from the latest main.
3. Inspect related implementation and tests; record acceptance criteria.
4. Implement the feature and regression tests.
5. Run `npm run validate` in `car-wash-erp/`.
6. Run the full GitHub Actions workflow `.github/workflows/build-installers.yml` and verify:
   - Android APK job succeeded.
   - Windows EXE installer job succeeded.
7. Review the diff for accidental deletions, secrets, data migrations and unrelated changes.
8. Open a PR to `main`; merge only after checks pass.
9. Verify the merged commit and main-branch workflow run. Retrieve the real APK artifact from that successful run.
10. Confirm the APK exists, is a valid ZIP/APK archive, and report size and SHA-256 if available.
11. Deliver a direct APK download link and the CI run link. Provide release notes and phone-test caveats.

Do not say "done" when only code has been edited. A completed delivery means the code is merged, the build is successful, and the actual APK artifact is linked—or a blocker is stated honestly.

## 4. Keep the handover current after every release

This is a continuing project. After each completed app release, update the handover documents in the repository:
- Replace the current baseline in `PROJECT_STATE.md` with the latest verified version, branch/main commit, app ID and build status.
- Add a dated release note file (do not delete older release records) with PR URL, merge commit, CI run URL, artifact name and ID, APK file size/hash, app ID and installation/data migration warning.
- Update `FEATURE_MAP.md` whenever code responsibilities or feature locations change.
- Update `START_HERE.md` if the primary repository, app folder or new-chat process changes.
- Update the reusable prompt if user constraints or the workflow change.
- Ensure old versions are labelled historical and never presented as the latest build.
- Include handover-document updates in the feature PR where practical; otherwise create a small follow-up docs PR.
- Refresh or rebuild the downloadable handover ZIP whenever release facts change, so an old ZIP does not masquerade as the latest source state.

## 5. Android package and signing continuity

The documented 2.8.2 build uses `com.washdesk.carwash.v19`. It is a debug APK produced by GitHub Actions using an ephemeral debug signing key. The v19 package was chosen to install beside v18 without replacing it.

- A package ID change creates a separate app installation. It does not migrate the old app's local storage.
- A package ID change is not a routine release version bump.
- Do not change the app ID or signing config without a clear reason and a safe data migration / rollback plan.
- Before using a newly installed app for real invoices, ensure it is paired to the same cloud workspace or restore a verified JSON backup.
- Never tell the owner to uninstall the previous working version before checking the new build's data.
- Never place a keystore or signing password in the repository or handover ZIP. If a persistent signing setup is introduced, use protected GitHub secrets and verify the release pipeline carefully.

## 6. Truthful testing statements

Separate automated CI results from manual handset acceptance testing.

A successful Android build does not prove:
- notification delivery after reboot;
- correct behavior under Doze / battery saver or vendor autostart limits;
- permission-denied and permission-revoked recovery;
- real WhatsApp share-sheet behavior on the owner's handset;
- printer / PDF viewing behavior on every Android version;
- cloud sync under real offline/online transitions;
- correct restoration from the owner's backup.

List these as phone tests unless they have actually been performed. Never invent a test result.

## 7. User interaction constraints

- The owner is a non-developer and primarily uses Android.
- Do not make the owner operate Git, SSH, shell commands, Android Studio or code editors.
- Do not ask the owner to provide credentials in chat.
- Use plain English, concise explanations and screenshots only when useful.
- The final deliverable should be the actual APK link, not instructions that leave the build unfinished.
- Ask only for information or permissions that genuinely cannot be obtained safely from the current repo / tools.

## 8. When a requested feature is too large for one safe release

Split work into stages with separate acceptance criteria. Keep `main` buildable after every merge. Do not merge half-finished code into the production branch simply to report progress. Maintain the existing app as the rollback baseline.

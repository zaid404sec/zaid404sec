# Prime Auto Care — Portable AI Handover Kit

_Last verified: 16 November 2026_

## The one link to give a new AI

**Repository (real source code):**  
https://github.com/zaid404sec/zaid404sec

**Application folder:**  
https://github.com/zaid404sec/zaid404sec/tree/main/car-wash-erp

**This handover folder:**  
https://github.com/zaid404sec/zaid404sec/tree/main/AI_HANDOVER

**Latest baseline:** version **2.8.3**, branch `main`, commit  
`52ac00acd65b251c3497d16a6eb2c69cdb5d5774`

This documentation is a portable project memory, not a replacement for the repository. The application source code in `car-wash-erp/` is the authoritative implementation. The newest main-branch source ZIP is available at https://github.com/zaid404sec/zaid404sec/archive/refs/heads/main.zip. Always re-read the current `main` branch before editing; a ZIP or old chat can become outdated.

## What to give an AI in a new chat

Give it either:
1. This handover ZIP, if you have it saved; or
2. The repository link above; ideally give both.

Then paste the complete text from [NEW_CHAT_PROMPT.md](NEW_CHAT_PROMPT.md), followed by the new feature you want. For example: "Add an appointment booking feature to the existing app."

**Your part should be simple:** attach the handover ZIP (or give the repository link), paste the prompt, and describe the feature. The AI should inspect the live source, edit through the connected GitHub workflow, run CI, and return the new APK. You should not need an SSH key, terminal, Git CLI, Android Studio or manual source editing. If the AI environment has no GitHub access, it must say that clearly; a ZIP by itself does not grant permission to push changes or run GitHub Actions.

If the AI cannot open GitHub links, it must tell you plainly that it needs the repository source ZIP. In GitHub, open the repository page, tap **Code → Download ZIP**, and attach that ZIP to the AI. Do not give the AI only the APK when asking it to change code: an APK is an installable build, not the editable project source.

## What this project is

Prime Auto Care / WashDesk is a car-wash business manager with:
- Customer and vehicle records.
- Service catalogue and vehicle-class pricing.
- Invoices, partial payments, due balances and invoice PDF sharing.
- Stock, purchases and usage tracking.
- Expenses and staff payroll/attendance/advances.
- Daily and monthly reports.
- Local notifications.
- Optional shared cloud data through Supabase.
- Android APK, Windows installer and PWA/web build paths.

## The user's working constraints

- The owner mainly uses an Android phone.
- The owner is not a developer and does not use a terminal, local Android Studio, Git CLI or SSH keys.
- The AI should do repository work through available GitHub tools / GitHub web workflow and GitHub Actions.
- The user's normal final action should be: download the newly built APK, install it, and perform clearly explained phone checks.
- Do not ask the owner to paste SSH keys, passwords, Supabase service-role keys, API secrets or personal access tokens into chat.
- Do not ask the owner to edit source files manually or run shell commands as the normal workflow.
- Explain only the necessary phone-side action in simple English. The owner's preferred response language is English.

## First actions required of every new AI

1. Read this file and all other `AI_HANDOVER/` documents.
2. Open the latest repository `main` branch and confirm the current version in `car-wash-erp/package.json`, Android app ID in `car-wash-erp/capacitor.config.json`, and latest successful GitHub Actions run.
3. Inspect the relevant code and tests before proposing or editing anything. Do not assume that the 2.8.3 snapshot remains the newest release.
4. Make the smallest safe change that meets the request. Preserve all unrelated working features.
5. Use a separate feature branch and pull request. Do not commit directly to `main` for application changes.
6. Run the validator and the complete Android + Windows CI workflow. Fix failures; do not merge while required CI is failing.
7. After a successful merge, wait for / verify the main-branch build, retrieve the actual APK artifact, validate the APK file, and give the owner a direct download link.
8. Explain what changed, what passed, what still needs a real-phone test, the new version, and any installation/data migration warning.

## Important rule: the app is a real business system

Treat existing records as valuable. Never wipe, reset, truncate, recreate, seed over, or destructively migrate the live database to add a feature. Do not remove existing customers, vehicles, invoices, payment records, payroll, inventory, expenses, backups or cloud data. Keep old records readable after upgrades. Use additive, backward-compatible schema changes only when necessary, and explain any required one-time owner action before doing it.

## Files in this handover

- [NEW_CHAT_PROMPT.md](NEW_CHAT_PROMPT.md) — copy/paste prompt for a fresh AI chat.
- [PROJECT_STATE.md](PROJECT_STATE.md) — current version, build and feature state.
- [FEATURE_MAP.md](FEATURE_MAP.md) — code areas and key integrations.
- [SAFE_CHANGE_RULES.md](SAFE_CHANGE_RULES.md) — non-negotiable release and data rules.
- [RELEASE_2.8.3.md](RELEASE_2.8.3.md) — current verified release facts and APK fingerprint.
- [RELEASE_2.8.2.md](RELEASE_2.8.2.md) — historical release record.

## Downloading the source ZIP

The complete repository source can be downloaded from GitHub:  
https://github.com/zaid404sec/zaid404sec/archive/refs/heads/main.zip

That link always points to the current `main` source, so it changes as new work is merged. For a reproducible snapshot, use the exact commit listed in the release notes or a ZIP saved at the same time as that release.

**Do not treat an old handover ZIP or old APK as newer than the repository's current main branch.**

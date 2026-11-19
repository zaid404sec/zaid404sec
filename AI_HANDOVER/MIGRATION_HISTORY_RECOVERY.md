# Supabase migration history recovery — 20 November 2026

The production Supabase project `jkjudmkqaebrgllemris` is already `ACTIVE_HEALTHY`, and its schema migrations have been applied. The remote migration ledger was created through a mixture of SQL-editor/MCP migration application and repository SQL files. Consequently, several local migration filename timestamps do not match the remote `version` values, even where the SQL content corresponds.

**Do not run `supabase db push` from this source snapshot until the migration ledger is reconciled.** It may treat old local files as new migrations and attempt to reapply schema changes. No production data or migration history was modified as part of this recovery note.

## Remote migration ledger (read from Supabase)

| Remote version | Remote name |
|---|---|
| 20261118044912 | 20261112000100_communications_automation |
| 20261118044923 | 20261117000100_google_reviews |
| 20261118044930 | 20261118000100_google_review_pubsub |
| 20261118045737 | 20261118050000_add_message_recipients_sync_merge |
| 20261118052642 | prime_auto_care_communications_automation_20261112 |
| 20261118084656 | 20261118082000_google_review_admins |
| 20261118142407 | google_ai_growth_studio_20261118 |
| 20261118144459 | google_growth_daily_runs_20261118143000 |
| 20261118161053 | prime_auto_care_bookings_20261118190000 |
| 20261118161055 | google_review_auto_reply_20261118193000 |
| 20261119034723 | booking_urgency_notifications_google_publication |
| 20261119041849 | booking_notification_fk_indexes |
| 20261119043635 | booking_notification_admin_access |
| 20261119053903 | booking_rejected_status_20261119080000 |
| 20261119085155 | booking_multi_device_notifications_20261119 |
| 20261119085216 | booking_status_actor_attribution_20261119 |
| 20261119085230 | booking_status_atomic_notifications_20261119 |
| 20261119085605 | google_ai_key_vault_setup_20261119 |
| 20261119090408 | booking_notification_realtime_20261119 |
| 20261119090556 | google_oauth_pubsub_vault_setup_20261119 |
| 20261119142834 | google_vault_setup_wizard |
| 20261119144606 | google_review_vault_cron |

## Recovered source files

The following remote migrations had no matching local source file when checked; source has now been restored from the live schema/function definitions:
- `20261119085155_booking_multi_device_notifications_20261119.sql`
- `20261119085216_booking_status_actor_attribution_20261119.sql`
- `20261119085230_booking_status_atomic_notifications_20261119.sql`
- `20261119085605_google_ai_key_vault_setup_20261119.sql`
- `20261119090408_booking_notification_realtime_20261119.sql`

The existing local source for Google OAuth/Pub/Sub Vault setup, Google Vault wizard, and Google review cron is present under later local filename timestamps. The earlier communications automation migration is also present, but the separate remote migration `20261118052642` needs its exact original SQL recovered before a clean fresh-project replay can be certified.

## Safe next procedure

1. Keep the connected production database as-is; do not reset or reseed it.
2. Reconcile every local migration filename to the exact remote version/name pair, and recover the original SQL for `20261118052642`.
3. Compare local schema against production with a read-only schema diff.
4. Only after the diff is clean, test `supabase db push --dry-run` against a separate staging project.
5. Do not use `db reset` on the production project.

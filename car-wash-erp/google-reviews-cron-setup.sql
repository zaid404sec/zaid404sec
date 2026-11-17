-- Run only after Google Review Edge Functions are deployed and secrets are configured.
-- The worker catches missed Google push notifications and refreshes connected Profiles.
-- It does not publish AI replies or send customer invitations.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Create these Vault secrets once, replacing placeholders with the project's real URL
-- and the EXACT same random value configured as GOOGLE_REVIEW_WORKER_SECRET
-- in Supabase Dashboard -> Edge Functions -> Secrets:
-- select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co/functions/v1/google-review-worker','pac_google_review_worker_url');
-- select vault.create_secret('YOUR_RANDOM_WORKER_SECRET','pac_google_review_worker_secret');

select cron.unschedule(jobid)
from cron.job
where jobname = 'prime-auto-care-google-reviews-worker';

select cron.schedule(
  'prime-auto-care-google-reviews-worker',
  '0 */4 * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'pac_google_review_worker_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-google-review-worker-secret',
        (select decrypted_secret from vault.decrypted_secrets where name = 'pac_google_review_worker_secret')
      ),
      body := jsonb_build_object('source', 'scheduled')
    ) as request_id;
  $$
);

select jobid, jobname, schedule, active
from cron.job
where jobname = 'prime-auto-care-google-reviews-worker';

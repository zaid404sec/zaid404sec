-- Run AFTER the communications migration is deployed and after the
-- same PAC_WORKER_SECRET has been added to Supabase Edge Function secrets.
-- Run this SQL once in Supabase SQL Editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Create/update these two Vault entries. Use the actual Supabase project URL.
-- The PAC_WORKER_SECRET value must exactly match the Edge Function secret.
-- After this schedule is created and verified, set the Edge Function secret
-- PAC_CRON_SETUP_COMPLETE=true so the app can safely enable unattended sending.
-- Replace the two placeholder values before running:
-- select vault.create_secret('https://YOUR_PROJECT_REF.supabase.co','pac_project_url');
-- select vault.create_secret('PASTE_THE_SAME_RANDOM_WORKER_SECRET_HERE','pac_worker_secret');

select cron.unschedule(jobid)
from cron.job
where jobname = 'prime-auto-care-communications-worker';

select cron.schedule(
  'prime-auto-care-communications-worker',
  '* * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'pac_project_url')
             || '/functions/v1/communication-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-pac-worker-secret',
        (select decrypted_secret from vault.decrypted_secrets where name = 'pac_worker_secret')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Check that the job exists and inspect its execution history:
select jobid, jobname, schedule, active
from cron.job
where jobname = 'prime-auto-care-communications-worker';


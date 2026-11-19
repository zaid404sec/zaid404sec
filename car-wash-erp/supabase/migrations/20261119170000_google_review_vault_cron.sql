-- Four-hour recovery sync for Google reviews. Pub/Sub remains the primary near-real-time trigger.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $block$
declare
  v_id uuid;
begin
  select id into v_id
  from vault.secrets
  where name = 'prime_auto_care_google_review_worker_url'
  limit 1;

  if v_id is null then
    perform vault.create_secret(
      'https://jkjudmkqaebrgllemris.supabase.co/functions/v1/google-review-worker',
      'prime_auto_care_google_review_worker_url',
      'Prime Auto Care Google review recovery worker endpoint',
      null
    );
  else
    perform vault.update_secret(
      v_id,
      'https://jkjudmkqaebrgllemris.supabase.co/functions/v1/google-review-worker',
      'prime_auto_care_google_review_worker_url',
      'Prime Auto Care Google review recovery worker endpoint',
      null
    );
  end if;
end;
$block$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'prime-auto-care-google-reviews-worker';

select cron.schedule(
  'prime-auto-care-google-reviews-worker',
  '0 */4 * * *',
  $job$
    with worker as (
      select d.decrypted_secret as worker_secret
      from public.pac_google_review_worker_secrets s
      join vault.decrypted_secrets d on d.id = s.vault_secret_id
      join public.washdesk_workspaces w on w.id = s.workspace_id
      where w.business_name = 'Prime Auto Care'
      limit 1
    ),
    endpoint as (
      select decrypted_secret as worker_url
      from vault.decrypted_secrets
      where name = 'prime_auto_care_google_review_worker_url'
      limit 1
    )
    select net.http_post(
      url := endpoint.worker_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-google-review-worker-secret', worker.worker_secret
      ),
      body := jsonb_build_object('source', 'scheduled')
    ) as request_id
    from worker, endpoint
    where worker.worker_secret is not null and endpoint.worker_url is not null;
  $job$
);

select jobid, jobname, schedule, active
from cron.job
where jobname = 'prime-auto-care-google-reviews-worker';

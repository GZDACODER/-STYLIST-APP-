-- The every-minute waitlist check, run by Supabase (free).
-- Supabase calls your site's /api/waitlist/run address once a minute, so
-- waitlisted clients hear about newly opened times, and everyone else hears
-- once the Regulars' head start is over.
--
-- Before you run this, change the TWO values in the first lines below:
--   1. your Vercel address (no slash at the end)
--   2. your CRON_SECRET (exactly the same as in Vercel)
-- Then paste it all into Supabase -> SQL Editor -> New query, and press Run.
-- Running it again later is safe (for example after changing either value).

do $setup$
declare
  v_site_url text := 'https://YOUR-APP.vercel.app';
  v_cron_secret text := 'PASTE-YOUR-CRON-SECRET-HERE';
  v_id uuid;
begin
  if v_site_url like '%YOUR-APP%' or v_cron_secret like 'PASTE-%' then
    raise exception 'Change the two values at the top of this SQL first.';
  end if;

  -- Kept in Supabase's Vault (encrypted), not in plain sight.
  select id into v_id from vault.secrets where name = 'waitlist_site_url';
  if v_id is null then
    perform vault.create_secret(rtrim(v_site_url, '/'), 'waitlist_site_url');
  else
    perform vault.update_secret(v_id, rtrim(v_site_url, '/'));
  end if;

  v_id := null;
  select id into v_id from vault.secrets where name = 'waitlist_cron_secret';
  if v_id is null then
    perform vault.create_secret(v_cron_secret, 'waitlist_cron_secret');
  else
    perform vault.update_secret(v_id, v_cron_secret);
  end if;
end
$setup$;

-- The scheduler (pg_cron) and the web caller (pg_net).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Every minute: call the site. (Using the same name again replaces the old job.)
select cron.schedule(
  'waitlist-check',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'waitlist_site_url')
      || '/api/waitlist/run',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'waitlist_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $job$
);

-- Once a day: tidy up the scheduler's own log, so it doesn't grow forever.
select cron.schedule(
  'waitlist-check-tidy',
  '17 3 * * *',
  $job$ delete from cron.job_run_details where end_time < now() - interval '7 days' $job$
);

-- To stop the every-minute check later, run:
--   select cron.unschedule('waitlist-check');
--   select cron.unschedule('waitlist-check-tidy');

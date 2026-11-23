-- Step 50: counting the emails the site sends (lib/notify.js logs each one:
-- when, whether it went, the subject; never the address), so the Control
-- Room can show today's count against Resend's daily limit and the nightly
-- check can warn before it's reached. Kept 90 days. Server only.
-- Safe to run more than once.

create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ok boolean not null,
  subject text not null default '',
  error text
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;

-- ops_stats() again (from 0052), now with the email counts.
create or replace function public.ops_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
  job jsonb := null;
  calls jsonb := null;
begin
  select jsonb_build_object(
    'db_bytes', pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum((metadata ->> 'size')::bigint) from storage.objects), 0),
    'photos', (select count(*) from storage.objects),
    'pros', (select count(*) from public.stylists),
    'pros_7d', (select count(*) from public.stylists where created_at > now() - interval '7 days'),
    'bookings_7d', (select count(*) from public.bookings where created_at > now() - interval '7 days'),
    'bookings_upcoming', (select count(*) from public.bookings where status = 'confirmed' and booking_date >= current_date),
    'clients', (select count(*) from public.clients),
    'errors_24h', (select count(*) from public.error_alerts where last_seen > now() - interval '24 hours'),
    'last_after_visit', (select max(after_visit_sent_at) from public.bookings),
    -- Emails the site sent (email_log), by day in Central time.
    'emails_today', (select count(*) from public.email_log
      where ok and (created_at at time zone 'America/Chicago')::date = (now() at time zone 'America/Chicago')::date),
    'emails_failed_24h', (select count(*) from public.email_log where not ok and created_at > now() - interval '24 hours'),
    'emails_week', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'sent', n) order by d), '[]'::jsonb) from (
      select (created_at at time zone 'America/Chicago')::date as d, count(*) filter (where ok) as n
      from public.email_log where created_at > now() - interval '7 days' group by 1) w),
    'email_log_ready', true,
    'after_visit_stuck', (
      select count(*) from public.bookings b join public.stylists s on s.id = b.stylist_id
      where b.status = 'confirmed' and b.after_visit_sent_at is null
        and coalesce(b.outcome, '') <> 'no_show' and coalesce(b.client_email, '') like '%@%'
        and b.cancel_token is not null
        and b.booking_date + b.end_time <= (now() at time zone s.timezone) - interval '2 hours 15 minutes'
        and b.booking_date + b.end_time > (now() at time zone s.timezone) - interval '3 days')
  ) into result;

  -- The every-minute job (pg_cron), if it's set up.
  begin
    select jsonb_build_object(
      'last_run', max(d.start_time),
      'failed_1h', count(*) filter (where d.status = 'failed' and d.start_time > now() - interval '1 hour'),
      'runs_1h', count(*) filter (where d.start_time > now() - interval '1 hour'))
    into job
    from cron.job_run_details d join cron.job j on j.jobid = d.jobid
    where j.jobname = 'waitlist-check' and d.start_time > now() - interval '1 day';
  exception when others then job := null;
  end;

  -- What the site answered to those calls (pg_net keeps a few hours).
  begin
    select jsonb_build_object(
      'last_at', max(created),
      'ok_1h', count(*) filter (where status_code between 200 and 299 and created > now() - interval '1 hour'),
      'bad_1h', count(*) filter (where (status_code is null or status_code >= 300) and created > now() - interval '1 hour'))
    into calls
    from net._http_response
    where created > now() - interval '6 hours';
  exception when others then calls := null;
  end;

  return result || jsonb_build_object('job', job, 'calls', calls);
end;
$$;

revoke all on function public.ops_stats() from public, anon, authenticated;
grant execute on function public.ops_stats() to service_role;

-- Every night: drop email log rows older than 90 days.
select cron.schedule('email-log-tidy', '27 9 * * *', $job$ delete from public.email_log where created_at < now() - interval '90 days' $job$);

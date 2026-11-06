-- Step 19: the weekly summary email. Every Monday from 8 AM (the business's
-- own time), the every-minute check emails each business a summary of last
-- week (Monday to Sunday) and what's booked this week.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0023_visit_outcomes.sql first. Running this again later is safe.

-- The Monday the summary last went out.
alter table public.stylists add column if not exists weekly_summary_sent_on date;

-- Who's due a summary right now, with their numbers (at most 100 at a time).
-- A business with nothing last week and nothing this week is skipped (and
-- marked, so it isn't checked again until next Monday).
create or replace function public.weekly_summary_due()
returns table (
  stylist_id uuid,
  business_name text,
  first_name text,
  week_start date,
  week_end date,
  visits integer,
  booked_cents bigint,
  deposits_cents bigint,
  no_shows integer,
  replaced integer,
  cancellations integer,
  waitlist_fills integer,
  new_clients integer,
  unmarked integer,
  owed_count integer,
  owed_cents bigint,
  this_week integer,
  this_week_cents bigint,
  this_week_unpaid integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with due as (
    select s.*, (now() at time zone s.timezone)::date as today
    from public.stylists s
    where extract(isodow from (now() at time zone s.timezone)) = 1
      and (now() at time zone s.timezone)::time >= time '08:00'
      and s.weekly_summary_sent_on is distinct from (now() at time zone s.timezone)::date
    limit 100
  )
  select d.id, d.business_name, d.first_name, d.today - 7, d.today - 1,
    -- Last week's visits that went ahead (not no-shows or someone else).
    (select count(*)::integer from public.bookings b
     where b.stylist_id = d.id and b.status = 'confirmed'
       and b.booking_date between d.today - 7 and d.today - 1
       and coalesce(b.outcome, '') not in ('no_show', 'replaced')),
    (select coalesce(sum(b.price_cents), 0)::bigint from public.bookings b
     where b.stylist_id = d.id and b.status = 'confirmed'
       and b.booking_date between d.today - 7 and d.today - 1
       and coalesce(b.outcome, '') not in ('no_show', 'replaced')),
    -- Deposits paid during last week (in the business's own time).
    (select coalesce(sum(b.deposit_cents), 0)::bigint from public.bookings b
     where b.stylist_id = d.id and b.deposit_status = 'paid'
       and (b.deposit_paid_at at time zone d.timezone)::date between d.today - 7 and d.today - 1),
    (select count(*)::integer from public.bookings b
     where b.stylist_id = d.id and b.status = 'confirmed' and b.outcome = 'no_show'
       and b.booking_date between d.today - 7 and d.today - 1),
    (select count(*)::integer from public.bookings b
     where b.stylist_id = d.id and b.status = 'confirmed' and b.outcome = 'replaced'
       and b.booking_date between d.today - 7 and d.today - 1),
    (select count(*)::integer from public.bookings b
     where b.stylist_id = d.id and b.status = 'cancelled'
       and b.booking_date between d.today - 7 and d.today - 1),
    -- Times the waitlist filled last week.
    (select count(*)::integer from public.waitlist_offers o
     where o.stylist_id = d.id and o.claimed_at is not null
       and (o.claimed_at at time zone d.timezone)::date between d.today - 7 and d.today - 1),
    (select count(*)::integer from public.clients c
     where c.stylist_id = d.id
       and (c.created_at at time zone d.timezone)::date between d.today - 7 and d.today - 1),
    -- Visits from the last 14 days still to wrap up.
    (select count(*)::integer from public.bookings b
     where b.stylist_id = d.id and b.status = 'confirmed' and b.outcome is null
       and b.booking_date between d.today - 14 and d.today - 1),
    -- Balances owed (any date): the price, less a paid deposit.
    (select count(*)::integer from public.bookings b
     where b.stylist_id = d.id and b.status = 'confirmed' and b.outcome = 'completed_owed'),
    (select coalesce(sum(greatest(0, b.price_cents
       - case when b.deposit_status = 'paid' then b.deposit_cents else 0 end)), 0)::bigint
     from public.bookings b
     where b.stylist_id = d.id and b.status = 'confirmed' and b.outcome = 'completed_owed'),
    -- This week (Monday to Sunday).
    (select count(*)::integer from public.bookings b
     where b.stylist_id = d.id and b.status = 'confirmed'
       and b.booking_date between d.today and d.today + 6),
    (select coalesce(sum(b.price_cents), 0)::bigint from public.bookings b
     where b.stylist_id = d.id and b.status = 'confirmed'
       and b.booking_date between d.today and d.today + 6),
    (select count(*)::integer from public.bookings b
     where b.stylist_id = d.id and b.status = 'confirmed' and b.deposit_status = 'unpaid'
       and b.booking_date between d.today and d.today + 6)
  from due d
$$;

-- Notes the summary went out (or was skipped) for this Monday.
create or replace function public.weekly_summary_mark(p_stylist_id uuid, p_date date)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.stylists set weekly_summary_sent_on = p_date where id = p_stylist_id
$$;

revoke execute on function public.weekly_summary_due() from public, anon, authenticated;
revoke execute on function public.weekly_summary_mark(uuid, date) from public, anon, authenticated;
grant execute on function public.weekly_summary_due() to service_role;
grant execute on function public.weekly_summary_mark(uuid, date) to service_role;

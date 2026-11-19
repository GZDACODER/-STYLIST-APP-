-- Step 40: more on each My Pros card (clientelesuite.com/my).
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0044_disputes.sql first. Running this again later is safe.
--
-- For the signed-in client only (same rule as get_my_pros: booked while
-- logged in as them, or older bookings made with their proved email):
--   'deposit'  - an upcoming visit with a deposit still to pay (standing
--                visits), with its pay link token
--   'standing' - their next held standing visits (up to 4 per pro), with
--                how often they repeat
--   'waitlist' - waitlists they're on, with the days and times they asked
--                for and the token for the "see or leave" page
-- Tokens are the same ones already emailed to them.
create or replace function public.get_my_pro_extras()
returns table (
  slug text,
  business_name text,
  kind text,
  item_date date,
  item_time time,
  label text,
  amount_cents integer,
  token text,
  repeat_weeks integer,
  days smallint[],
  times text[]
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select auth.uid() as uid, public.booking_verified_email() as email
  ),
  mine as (
    select b.*, s.slug as pro_slug, s.business_name as pro_name,
      b.booking_date + b.start_time > now() at time zone s.timezone as upcoming
    from public.bookings b
    join public.stylists s on s.id = b.stylist_id
    cross join me
    where me.uid is not null
      and b.status = 'confirmed'
      and (
        b.booked_by = me.uid
        or (b.booked_by is null and me.email is not null and lower(b.client_email) = me.email)
      )
  ),
  deposits as (
    select m.pro_slug, m.pro_name, 'deposit'::text, m.booking_date, m.start_time, m.service_name,
      m.deposit_cents, m.cancel_token, null::integer, null::smallint[], null::text[]
    from mine m
    where m.upcoming and m.deposit_status = 'unpaid' and m.deposit_cents > 0 and m.cancel_token is not null
  ),
  standing as (
    select x.pro_slug, x.pro_name, 'standing'::text, x.booking_date, x.start_time, x.service_name,
      null::integer, null::text, x.interval_weeks::integer, null::smallint[], null::text[]
    from (
      select m.pro_slug, m.pro_name, m.booking_date, m.start_time, m.service_name, ss.interval_weeks,
        row_number() over (partition by m.stylist_id order by m.booking_date, m.start_time) as n
      from mine m
      join public.standing_series ss on ss.id = m.standing_series_id
      where m.upcoming and m.standing_series_id is not null
    ) x
    where x.n <= 4
  ),
  waits as (
    select s.slug, s.business_name, 'waitlist'::text, null::date, null::time, sv.name,
      null::integer, w.manage_token, null::integer, w.days, w.times
    from public.waitlist_entries w
    join public.stylists s on s.id = w.stylist_id
    join public.services sv on sv.id = w.service_id
    cross join me
    where me.uid is not null
      and w.status = 'waiting'
      and (w.user_id = me.uid or (me.email is not null and lower(w.verified_email) = me.email))
  )
  select * from deposits
  union all select * from standing
  union all select * from waits
  order by 1, 3, 4, 5
$$;

revoke execute on function public.get_my_pro_extras() from public;
grant execute on function public.get_my_pro_extras() to anon, authenticated;

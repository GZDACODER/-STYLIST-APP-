-- Step 30: "My Pros" for clients (clientelesuite.com/my).
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0034_calendar_events.sql first. Running this again later is safe.
--
-- A client who confirmed their email (or phone) with a code sees every
-- business they've booked with: their next appointment, their last visit
-- and a "Book again" button. Bookings count as theirs by the same rule as
-- "Your upcoming appointments" (get_my_bookings): booked while logged in as
-- them, or older bookings made with their proved email.
-- The booking page also fills in their name and phone from their last
-- booking (get_my_details), so booking again is a couple of taps.

-- ============ MY PROS ============
create or replace function public.get_my_pros()
returns table (
  slug text,
  business_name text,
  cover_photo_url text,
  timezone text,
  viewer_status text,
  next_booking_id uuid,
  next_date date,
  next_start time,
  next_service text,
  upcoming_count integer,
  last_date date,
  last_service_id uuid,
  last_service_name text,
  visits integer
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
    select b.id, b.stylist_id, b.service_id, b.service_name, b.booking_date, b.start_time,
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
  pros as (
    select s.*, public.booking_viewer_status(s.id) as status
    from public.stylists s
    where s.id in (select stylist_id from mine)
  )
  select
    p.slug, p.business_name, nullif(p.cover_photo_url, ''), p.timezone, p.status,
    nx.id, nx.booking_date, nx.start_time, nx.service_name,
    (select count(*) from mine m where m.stylist_id = p.id and m.upcoming)::integer,
    ls.booking_date,
    -- Only a service that's still on their list can be booked again.
    case when exists (select 1 from public.services sv where sv.id = ls.service_id and sv.stylist_id = p.id)
      then ls.service_id end,
    ls.service_name,
    (select count(*) from mine m where m.stylist_id = p.id and not m.upcoming)::integer
  from pros p
  left join lateral (
    select m.* from mine m
    where m.stylist_id = p.id and m.upcoming
    order by m.booking_date, m.start_time
    limit 1
  ) nx on true
  left join lateral (
    select m.* from mine m
    where m.stylist_id = p.id and not m.upcoming
    order by m.booking_date desc, m.start_time desc
    limit 1
  ) ls on true
  -- A business that blocked them isn't listed.
  where p.status <> 'blocked'
  order by nx.booking_date nulls last, nx.start_time, ls.booking_date desc nulls last, p.business_name
$$;

-- ============ NAME AND PHONE FOR THE BOOKING FORM ============
-- From their newest booking with this business, else with anyone.
create or replace function public.get_my_details(p_slug text)
returns table (client_name text, client_phone text)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select auth.uid() as uid, public.booking_verified_email() as email
  )
  select b.client_name, b.client_phone
  from public.bookings b
  cross join me
  left join public.stylists s on s.id = b.stylist_id and s.slug = lower(p_slug)
  where me.uid is not null
    and b.status in ('confirmed', 'cancelled')
    and (
      b.booked_by = me.uid
      or (b.booked_by is null and me.email is not null and lower(b.client_email) = me.email)
    )
  order by (s.id is not null) desc, b.created_at desc
  limit 1
$$;

-- ============ WHO CAN CALL WHAT ============
revoke execute on function public.get_my_pros() from public;
revoke execute on function public.get_my_details(text) from public;
grant execute on function public.get_my_pros() to anon, authenticated;
grant execute on function public.get_my_details(text) to anon, authenticated;

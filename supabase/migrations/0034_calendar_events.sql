-- Step 29: personal events on the Calendar (birthdays, early school days,
-- practices), one-off or repeating, and "Block bookings".
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0033_intake.sql first. Running this again later is safe.
--
-- An event is all day, or from a start time to an end time. It can repeat
-- every week, every 2 weeks, every month (same date) or every year (same
-- date, for birthdays), optionally until a date. Single dates of a repeating
-- event can be skipped.
--
-- Events with "Block bookings" on take their time off the booking page
-- (and the waitlist and self-serve reschedule, which use the same open
-- times). Bookings already made aren't touched.

-- ============ EVENTS ============
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  -- The first (or only) date.
  starts_on date not null,
  -- Both empty: all day.
  start_time time,
  end_time time,
  repeats text not null default 'none'
    check (repeats in ('none', 'weekly', 'biweekly', 'monthly', 'yearly')),
  repeat_until date,
  -- Dates of a repeating event that were removed on their own.
  skipped_dates date[] not null default '{}',
  blocks_bookings boolean not null default false,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  check (
    (start_time is null and end_time is null)
    or (start_time is not null and end_time is not null and end_time > start_time)
  ),
  check (repeat_until is null or repeat_until >= starts_on),
  check (cardinality(skipped_dates) <= 500)
);

create index if not exists calendar_events_stylist_idx on public.calendar_events (stylist_id, starts_on);

alter table public.calendar_events enable row level security;

-- Only logged-in stylists, and only their own (the rules below).
revoke all on public.calendar_events from anon;
grant select, insert, update, delete on public.calendar_events to authenticated;

drop policy if exists "Stylists can view own events" on public.calendar_events;
create policy "Stylists can view own events"
  on public.calendar_events for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can add own events" on public.calendar_events;
create policy "Stylists can add own events"
  on public.calendar_events for insert
  to authenticated
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can update own events" on public.calendar_events;
create policy "Stylists can update own events"
  on public.calendar_events for update
  to authenticated
  using ((select auth.uid()) = stylist_id)
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can delete own events" on public.calendar_events;
create policy "Stylists can delete own events"
  on public.calendar_events for delete
  to authenticated
  using ((select auth.uid()) = stylist_id);

-- ============ DOES AN EVENT HAPPEN ON A DATE? ============
-- Same rules as lib/calendarEvents.js (eventOccursOn). A monthly event on
-- the 31st skips months without one.
create or replace function public.calendar_event_on(p_event public.calendar_events, p_day date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_day >= p_event.starts_on
    and (p_event.repeat_until is null or p_day <= p_event.repeat_until)
    and not (p_day = any (p_event.skipped_dates))
    and case p_event.repeats
      when 'none' then p_day = p_event.starts_on
      when 'weekly' then (p_day - p_event.starts_on) % 7 = 0
      when 'biweekly' then (p_day - p_event.starts_on) % 14 = 0
      when 'monthly' then extract(day from p_day) = extract(day from p_event.starts_on)
      when 'yearly' then extract(month from p_day) = extract(month from p_event.starts_on)
        and extract(day from p_day) = extract(day from p_event.starts_on)
      else false
    end
$$;

-- Is any "Block bookings" event in the way of this time (same day)?
create or replace function public.calendar_blocks(p_stylist_id uuid, p_start timestamp, p_end timestamp)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.calendar_events e
    where e.stylist_id = p_stylist_id
      and e.blocks_bookings
      and e.starts_on <= p_start::date
      and public.calendar_event_on(e, p_start::date)
      and (
        e.start_time is null
        or (p_start::date + e.start_time < p_end and p_start::date + e.end_time > p_start)
      )
  )
$$;

-- For the Calendar: upcoming bookings that clash with an event's times
-- (to warn the stylist when they save it). Next 12 months only.
create or replace function public.calendar_event_clashes(p_event_id uuid)
returns table (booking_id uuid, booking_date date, start_time time, client_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.booking_date, b.start_time, b.client_name
  from public.calendar_events e
  join public.stylists s on s.id = e.stylist_id
  join public.bookings b on b.stylist_id = e.stylist_id
  where e.id = p_event_id
    and e.stylist_id = auth.uid()
    and b.status = 'confirmed'
    and b.booking_date >= (now() at time zone s.timezone)::date
    and b.booking_date <= (now() at time zone s.timezone)::date + 366
    and public.calendar_event_on(e, b.booking_date)
    and (e.start_time is null or (b.start_time < e.end_time and b.end_time > e.start_time))
  order by b.booking_date, b.start_time
  limit 50
$$;

-- ============ OPEN TIMES (same as step 5, plus "Block bookings" events) ============
create or replace function public.booking_open_slots(
  p_stylist_id uuid,
  p_duration integer,
  p_viewer text
)
returns table (slot_date date, slot_time time, visibility text)
language sql
stable
security definer
set search_path = ''
as $$
  with stylist as (
    select (now() at time zone s.timezone) as ts, s.regulars_only
    from public.stylists s
    where s.id = p_stylist_id
  ),
  candidates as (
    select
      o.opening_date,
      gs.slot_start,
      st.regulars_only as mode_on,
      case
        when o.visibility = 'regulars'
          or exists (
            select 1 from public.regulars_holds h
            where h.stylist_id = p_stylist_id
              and h.hold_date = o.opening_date
              and h.hold_date + h.start_time < gs.slot_start + make_interval(mins => p_duration)
              and h.hold_date + h.end_time > gs.slot_start
          )
          or exists (
            select 1 from public.bookings bk
            where bk.stylist_id = p_stylist_id
              and bk.regulars_only
              and bk.status = 'pending_payment'
              and bk.hold_expires_at <= now()
              and bk.booking_date + bk.start_time < gs.slot_start + make_interval(mins => p_duration)
              and bk.booking_date + bk.end_time > gs.slot_start
          )
          then 'regulars'
        else 'everyone'
      end as visibility
    from public.openings o
    cross join stylist st
    cross join lateral generate_series(
      o.opening_date + o.start_time,
      o.opening_date + o.end_time - make_interval(mins => p_duration),
      interval '15 minutes'
    ) as gs(slot_start)
    where o.stylist_id = p_stylist_id
      and p_viewer <> 'blocked'
      and o.opening_date between st.ts::date and st.ts::date + 90
      and gs.slot_start >= st.ts + interval '1 hour'
      and not exists (
        select 1 from public.blocked_dates b
        where b.stylist_id = p_stylist_id and b.blocked_on = o.opening_date
      )
      and not public.calendar_blocks(
        p_stylist_id, gs.slot_start, gs.slot_start + make_interval(mins => p_duration)
      )
  )
  select c.opening_date, c.slot_start::time, c.visibility
  from candidates c
  where (c.visibility = 'everyone' or p_viewer = 'regular')
    and (not c.mode_on or p_viewer in ('regular', 'invited'))
    and not exists (
      select 1 from public.bookings bk
      where bk.stylist_id = p_stylist_id
        and (
          bk.status = 'confirmed'
          or (bk.status = 'pending_payment' and bk.hold_expires_at > now())
        )
        and bk.booking_date + bk.start_time < c.slot_start + make_interval(mins => p_duration)
        and bk.booking_date + bk.end_time > c.slot_start
    )
$$;

-- ============ WAITLIST FREE TIME (same as step 5, plus "Block bookings" events) ============
create or replace function public.waitlist_sync_free_time(p_stylist_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  with local_now as (
    select (now() at time zone s.timezone) as ts
    from public.stylists s
    where s.id = p_stylist_id
  ),
  free as (
    select
      gs.block_start,
      case
        when o.visibility = 'regulars' or exists (
          select 1 from public.regulars_holds h
          where h.stylist_id = p_stylist_id
            and h.hold_date = o.opening_date
            and h.hold_date + h.start_time < gs.block_start + interval '15 minutes'
            and h.hold_date + h.end_time > gs.block_start
        ) then 'regulars'
        else 'everyone'
      end as visibility
    from public.openings o
    cross join local_now n
    cross join lateral generate_series(
      o.opening_date + o.start_time,
      o.opening_date + o.end_time - interval '15 minutes',
      interval '15 minutes'
    ) as gs(block_start)
    where o.stylist_id = p_stylist_id
      and o.opening_date between n.ts::date and n.ts::date + 90
      and not exists (
        select 1 from public.blocked_dates b
        where b.stylist_id = p_stylist_id and b.blocked_on = o.opening_date
      )
      and not public.calendar_blocks(p_stylist_id, gs.block_start, gs.block_start + interval '15 minutes')
      and not exists (
        select 1 from public.bookings bk
        where bk.stylist_id = p_stylist_id
          and (
            bk.status = 'confirmed'
            or (bk.status = 'pending_payment' and bk.hold_expires_at > now())
          )
          and bk.booking_date + bk.start_time < gs.block_start + interval '15 minutes'
          and bk.booking_date + bk.end_time > gs.block_start
      )
  ),
  gone as (
    delete from public.waitlist_free_time w
    where w.stylist_id = p_stylist_id
      and not exists (select 1 from free f where f.block_start = w.starts_at)
  )
  insert into public.waitlist_free_time as w (stylist_id, starts_at, visibility, opened_at, public_at)
  select p_stylist_id, f.block_start, f.visibility, now(),
    case when f.visibility = 'everyone' then now() end
  from free f
  on conflict (stylist_id, starts_at) do update
  set visibility = excluded.visibility,
      -- Switching "Regulars only" to "Everyone" counts as new for everyone else.
      public_at = case when excluded.visibility = 'everyone' then coalesce(w.public_at, now()) end
  where w.visibility is distinct from excluded.visibility
$$;

-- ============ WHO CAN CALL WHAT ============
revoke execute on function public.calendar_event_on(public.calendar_events, date) from public, anon, authenticated;
revoke execute on function public.calendar_blocks(uuid, timestamp, timestamp) from public, anon, authenticated;
revoke execute on function public.booking_open_slots(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.waitlist_sync_free_time(uuid) from public, anon, authenticated;
revoke execute on function public.calendar_event_clashes(uuid) from public, anon;
grant execute on function public.calendar_event_clashes(uuid) to authenticated;

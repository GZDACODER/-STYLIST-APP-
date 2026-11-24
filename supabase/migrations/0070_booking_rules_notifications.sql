-- Step 66: Settings > Booking rules and Settings > Notifications.
-- Booking rules feed booking_open_slots (used by the booking page, the
-- waitlist and create_booking, so they're enforced at booking too). The
-- defaults are exactly how it worked before: 1 hour notice, 90 days ahead,
-- no buffer, a start every 15 minutes, no daily limit.

alter table public.stylists add column if not exists min_notice_minutes integer not null default 60;
alter table public.stylists add column if not exists max_days_ahead integer not null default 90;
alter table public.stylists add column if not exists buffer_minutes integer not null default 0;
alter table public.stylists add column if not exists slot_step_minutes integer not null default 15;
alter table public.stylists add column if not exists daily_limit integer;
-- Which emails the pro wants: { "new_booking": false, ... }; missing = on.
alter table public.stylists add column if not exists notify jsonb not null default '{}'::jsonb;
do $$ begin
  alter table public.stylists add constraint stylists_booking_rules_check check (
    min_notice_minutes between 0 and 20160
    and max_days_ahead between 1 and 365
    and buffer_minutes between 0 and 120
    and slot_step_minutes in (15, 30, 60)
    and (daily_limit is null or daily_limit between 1 and 40)
  );
exception when duplicate_object then null; end $$;
grant update (min_notice_minutes, max_days_ahead, buffer_minutes, slot_step_minutes, daily_limit, notify) on public.stylists to authenticated;

create or replace function public.booking_open_slots(p_stylist_id uuid, p_duration integer, p_viewer text)
returns table(slot_date date, slot_time time without time zone, visibility text)
language sql
stable security definer
set search_path to ''
as $function$
  with stylist as (
    select (now() at time zone s.timezone) as ts, s.regulars_only,
           s.min_notice_minutes, s.max_days_ahead, s.buffer_minutes, s.slot_step_minutes, s.daily_limit
    from public.stylists s
    where s.id = p_stylist_id
  ),
  candidates as (
    select
      o.opening_date,
      gs.slot_start,
      st.regulars_only as mode_on,
      st.buffer_minutes,
      st.daily_limit,
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
      make_interval(mins => st.slot_step_minutes)
    ) as gs(slot_start)
    where o.stylist_id = p_stylist_id
      and p_viewer <> 'blocked'
      and o.opening_date between st.ts::date and st.ts::date + st.max_days_ahead
      and gs.slot_start >= st.ts + make_interval(mins => st.min_notice_minutes)
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
        -- The buffer keeps that much free time before and after each booking.
        and bk.booking_date + bk.start_time - make_interval(mins => c.buffer_minutes) < c.slot_start + make_interval(mins => p_duration)
        and bk.booking_date + bk.end_time + make_interval(mins => c.buffer_minutes) > c.slot_start
    )
    and (
      c.daily_limit is null
      or (
        select count(*) from public.bookings bk
        where bk.stylist_id = p_stylist_id
          and bk.booking_date = c.opening_date
          and (bk.status = 'confirmed' or (bk.status = 'pending_payment' and bk.hold_expires_at > now()))
      ) < c.daily_limit
    )
$function$;

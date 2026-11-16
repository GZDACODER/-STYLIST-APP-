-- Step 31: standing appointments skip times blocked by Calendar events.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0035_my_pros.sql first. Running this again later is safe.
--
-- When a standing visit would land in a "Block bookings" event (step 29),
-- it isn't booked. It shows on the Today page as "Not held" (like a time
-- that was already taken), and it's booked automatically once the event is
-- removed or changed. Visits booked before the event was added stay booked
-- and are flagged on the Today page, so the stylist can move, skip or keep
-- them (nothing is cancelled silently).

-- Why a standing date wasn't held: 'booked' (someone else has the time) or
-- 'event' (a Block bookings event covers it).
alter table public.standing_clashes add column if not exists reason text not null default 'booked';
alter table public.standing_clashes drop constraint if exists standing_clashes_reason_check;
alter table public.standing_clashes add constraint standing_clashes_reason_check check (reason in ('booked', 'event'));

-- ============ HOLDING THE NEXT 3 MONTHS (same as step 16, skipping event times) ============
create or replace function public.standing_fill(p_series_id uuid default null)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_series public.standing_series;
  v_stylist public.stylists;
  v_service public.services;
  v_client public.clients;
  v_local timestamp;
  v_today date;
  v_last date;
  v_step integer;
  v_date date;
  v_k integer;
  v_deposit integer;
  v_end time;
  v_held integer := 0;
begin
  for v_series in
    select * from public.standing_series ss
    where ss.status = 'active'
      and (
        (p_series_id is not null and ss.id = p_series_id)
        or (p_series_id is null and (ss.filled_at is null or ss.filled_at < now() - interval '6 hours'))
      )
    order by ss.filled_at nulls first
    limit case when p_series_id is null then 50 else 1 end
  loop
    update public.standing_series set filled_at = now() where id = v_series.id;

    select * into v_stylist from public.stylists where id = v_series.stylist_id;
    select * into v_service from public.services where id = v_series.service_id;
    select * into v_client from public.clients where id = v_series.client_id;
    if v_client.status <> 'regular'
       or not public.stylist_has_feature(v_series.stylist_id, 'regulars') then
      continue;
    end if;

    -- Same lock as create_booking, so a client can't book the time meanwhile.
    perform pg_advisory_xact_lock(hashtext(v_stylist.id::text));

    v_local := now() at time zone v_stylist.timezone;
    v_today := v_local::date;
    v_last := least(coalesce(v_series.end_date, v_today + 91), v_today + 91);
    v_step := v_series.interval_weeks * 7;
    v_end := v_series.start_time + make_interval(mins => v_service.duration_minutes);
    -- A visit can't run past midnight.
    if v_end <= v_series.start_time then
      continue;
    end if;

    -- The first visit from today on.
    v_k := greatest(0, ceil((v_today - v_series.first_date)::numeric / v_step)::integer);
    v_date := v_series.first_date + v_k * v_step;

    while v_date <= v_last loop
      if v_date + v_series.start_time > v_local + interval '1 hour'
         and not exists (
           select 1 from public.bookings b
           where b.standing_series_id = v_series.id and b.standing_date = v_date
         )
         and not exists (
           select 1 from public.standing_clashes c
           where c.series_id = v_series.id and c.standing_date = v_date and c.dismissed
         )
      then
        v_deposit := case
          when v_series.deposit_mode = 'each' then public.service_deposit_cents(v_stylist, v_service)
          else 0
        end;
        -- A "Block bookings" event covers this time (step 29): don't book it.
        -- Noted like a clash, and tried again next time (so it's booked once
        -- the event is gone).
        if public.calendar_blocks(v_stylist.id, v_date + v_series.start_time, v_date + v_end) then
          insert into public.standing_clashes (series_id, standing_date, reason)
          values (v_series.id, v_date, 'event')
          on conflict (series_id, standing_date) do update set reason = 'event';
          v_date := v_date + v_step;
          continue;
        end if;
        begin
          insert into public.bookings (
            stylist_id, service_id, client_id, service_name, price_cents,
            booking_date, start_time, end_time, client_name, client_email, client_phone,
            status, deposit_cents, deposit_status, cancellation_policy,
            standing_series_id, standing_date
          )
          values (
            v_stylist.id, v_service.id, v_client.id, v_service.name, v_service.price_cents,
            v_date, v_series.start_time, v_end, v_client.name,
            lower(coalesce(v_client.email, '')), coalesce(v_client.phone, ''),
            'confirmed', v_deposit, case when v_deposit > 0 then 'unpaid' else 'none' end,
            coalesce(v_stylist.cancellation_policy, ''),
            v_series.id, v_date
          );
          delete from public.standing_clashes
          where series_id = v_series.id and standing_date = v_date;
          v_held := v_held + 1;
        exception
          when exclusion_violation then
            insert into public.standing_clashes (series_id, standing_date, reason)
            values (v_series.id, v_date, 'booked')
            on conflict (series_id, standing_date) do update set reason = 'booked';
        end;
      end if;
      v_date := v_date + v_step;
    end loop;
  end loop;
  return v_held;
end;
$$;


-- ============ TODAY PAGE FLAGS (same as step 16, plus events) ============
--   event          - a held visit is inside a Block bookings event
--   event_skipped  - a visit wasn't held because an event covers its time
create or replace function public.standing_flags()
returns table (
  kind text,
  booking_id uuid,
  series_id uuid,
  client_name text,
  service_name text,
  booking_date date,
  start_time time,
  end_time time,
  deposit_cents integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select s.id, now() at time zone s.timezone as local_now
    from public.stylists s
    where s.id = auth.uid()
  ),
  visits as (
    select b.*, wh.is_working, wh.start_time as work_start, wh.end_time as work_end,
      exists (
        select 1 from public.blocked_dates bd
        where bd.stylist_id = b.stylist_id and bd.blocked_on = b.booking_date
      ) as blocked,
      public.calendar_blocks(b.stylist_id, b.booking_date + b.start_time, b.booking_date + b.end_time) as event_blocked
    from public.bookings b
    join me on me.id = b.stylist_id
    left join public.working_hours wh
      on wh.stylist_id = b.stylist_id and wh.weekday = extract(dow from b.booking_date)::smallint
    where b.standing_series_id is not null
      and b.status = 'confirmed'
      and b.booking_date + b.start_time > me.local_now
      and b.booking_date <= me.local_now::date + 92
  )
  select
    case
      when v.blocked then 'day_off'
      when v.event_blocked then 'event'
      when v.is_working = false then 'not_working'
      else 'outside_hours'
    end,
    v.id, v.standing_series_id, v.client_name, v.service_name,
    v.booking_date, v.start_time, v.end_time, v.deposit_cents
  from visits v
  where not v.standing_keep
    and (
      v.blocked
      or v.event_blocked
      or v.is_working = false
      or (v.is_working and (v.start_time < v.work_start or v.end_time > v.work_end))
    )
  union all
  select 'deposit_unpaid', v.id, v.standing_series_id, v.client_name, v.service_name,
    v.booking_date, v.start_time, v.end_time, v.deposit_cents
  from visits v
  cross join me
  where v.deposit_status = 'unpaid'
    and v.deposit_cents > 0
    and v.booking_date + v.start_time <= me.local_now + interval '48 hours'
  union all
  select case when sc.reason = 'event' then 'event_skipped' else 'clash' end, null, ss.id, c.name, sv.name, sc.standing_date, ss.start_time,
    ss.start_time + make_interval(mins => sv.duration_minutes), 0
  from public.standing_clashes sc
  join public.standing_series ss on ss.id = sc.series_id
  join me on me.id = ss.stylist_id
  join public.clients c on c.id = ss.client_id
  join public.services sv on sv.id = ss.service_id
  where not sc.dismissed
    and ss.status = 'active'
    and sc.standing_date >= me.local_now::date
  order by 6, 7
$$;

-- ============ TRY AGAIN NOW ============
-- After the stylist adds, changes or deletes an event: re-check all their
-- standing appointments straight away (instead of within 6 hours), so
-- freed dates are booked and newly blocked ones are noted.
create or replace function public.standing_refill_mine()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_total integer := 0;
begin
  for v_id in
    select id from public.standing_series where stylist_id = auth.uid() and status = 'active'
  loop
    v_total := v_total + public.standing_fill(v_id);
  end loop;
  return v_total;
end;
$$;

-- ============ WHO CAN CALL WHAT ============
revoke execute on function public.standing_fill(uuid) from public, anon, authenticated;
revoke execute on function public.standing_flags() from public, anon;
grant execute on function public.standing_flags() to authenticated;
revoke execute on function public.standing_refill_mine() from public, anon;
grant execute on function public.standing_refill_mine() to authenticated;

-- Step 34: more Calendar options.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0038_assistant_addon.sql first. Running this again later is safe.
--
--   - A colour for each event.
--   - More ways to repeat: every day; every week (or every 2 weeks) on chosen
--     days, like Tuesday and Thursday; every month on a weekday, like the
--     2nd Tuesday or the last Friday.
--   - "Close on holidays": a business can close on any US federal holiday
--     (Settings). Closed holidays take that day's times off the booking page,
--     the waitlist and self-serve reschedule, and standing appointments skip
--     them, exactly like an all-day "Block bookings" event.
-- (Editing or deleting "this date only" / "this and following" needs no SQL.)

-- ============ EVENTS: COLOUR AND REPEAT OPTIONS ============
alter table public.calendar_events add column if not exists color text not null default 'gray';
alter table public.calendar_events drop constraint if exists calendar_events_color_check;
alter table public.calendar_events add constraint calendar_events_color_check
  check (color in ('gray', 'gold', 'rose', 'blue', 'green', 'purple'));

-- Weekly / every 2 weeks: which weekdays (0 = Sunday ... 6 = Saturday).
-- Empty: the weekday of the first date.
alter table public.calendar_events add column if not exists repeat_days smallint[] not null default '{}';
alter table public.calendar_events drop constraint if exists calendar_events_repeat_days_check;
alter table public.calendar_events add constraint calendar_events_repeat_days_check
  check (repeat_days <@ '{0,1,2,3,4,5,6}'::smallint[]);

-- Monthly: 'date' (the same date, e.g. the 16th), 'weekday' (the same
-- weekday of the month as the first date, e.g. the 3rd Monday) or
-- 'last_weekday' (e.g. the last Friday).
alter table public.calendar_events add column if not exists monthly_mode text not null default 'date';
alter table public.calendar_events drop constraint if exists calendar_events_monthly_mode_check;
alter table public.calendar_events add constraint calendar_events_monthly_mode_check
  check (monthly_mode in ('date', 'weekday', 'last_weekday'));

-- Every day.
alter table public.calendar_events drop constraint if exists calendar_events_repeats_check;
alter table public.calendar_events add constraint calendar_events_repeats_check
  check (repeats in ('none', 'daily', 'weekly', 'biweekly', 'monthly', 'yearly'));

-- ============ DOES AN EVENT HAPPEN ON A DATE? (same rules as lib/calendarEvents.js) ============
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
      when 'daily' then true
      when 'weekly' then
        case when cardinality(p_event.repeat_days) = 0
          then (p_day - p_event.starts_on) % 7 = 0
          else extract(dow from p_day)::smallint = any (p_event.repeat_days)
        end
      when 'biweekly' then
        -- Weeks counted from the Sunday of the first date's week.
        ((p_day - (p_event.starts_on - extract(dow from p_event.starts_on)::integer)) / 7) % 2 = 0
        and case when cardinality(p_event.repeat_days) = 0
          then extract(dow from p_day) = extract(dow from p_event.starts_on)
          else extract(dow from p_day)::smallint = any (p_event.repeat_days)
        end
      when 'monthly' then
        case p_event.monthly_mode
          when 'weekday' then
            extract(dow from p_day) = extract(dow from p_event.starts_on)
            and ceil(extract(day from p_day) / 7.0) = ceil(extract(day from p_event.starts_on) / 7.0)
          when 'last_weekday' then
            -- "The last Friday": no same weekday later in the month.
            extract(dow from p_day) = extract(dow from p_event.starts_on)
            and extract(month from p_day + 7) <> extract(month from p_day)
          else extract(day from p_day) = extract(day from p_event.starts_on)
        end
      when 'yearly' then extract(month from p_day) = extract(month from p_event.starts_on)
        and extract(day from p_day) = extract(day from p_event.starts_on)
      else false
    end
$$;

-- ============ US FEDERAL HOLIDAYS (same dates as lib/holidays.js) ============
-- The nth weekday (0 = Sunday) of a month; p_n = -1 for the last one.
create or replace function public.nth_weekday(p_year integer, p_month integer, p_dow integer, p_n integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select case
    when p_n > 0 then
      make_date(p_year, p_month, 1)
        + ((p_dow - extract(dow from make_date(p_year, p_month, 1))::integer + 7) % 7)
        + (p_n - 1) * 7
    else
      (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date
        - ((extract(dow from (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date)::integer - p_dow + 7) % 7)
  end
$$;

-- The 11 federal holidays of a year, on their actual dates.
create or replace function public.us_federal_holidays(p_year integer)
returns table (holiday_key text, holiday_date date)
language sql
immutable
set search_path = ''
as $$
  values
    ('new_years', make_date(p_year, 1, 1)),
    ('mlk', public.nth_weekday(p_year, 1, 1, 3)),
    ('presidents', public.nth_weekday(p_year, 2, 1, 3)),
    ('memorial', public.nth_weekday(p_year, 5, 1, -1)),
    ('juneteenth', make_date(p_year, 6, 19)),
    ('independence', make_date(p_year, 7, 4)),
    ('labor', public.nth_weekday(p_year, 9, 1, 1)),
    ('columbus', public.nth_weekday(p_year, 10, 1, 2)),
    ('veterans', make_date(p_year, 11, 11)),
    ('thanksgiving', public.nth_weekday(p_year, 11, 4, 4)),
    ('christmas', make_date(p_year, 12, 25))
$$;

-- ============ CLOSE ON HOLIDAYS ============
create table if not exists public.stylist_holiday_settings (
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  holiday_key text not null check (holiday_key in (
    'new_years', 'mlk', 'presidents', 'memorial', 'juneteenth', 'independence',
    'labor', 'columbus', 'veterans', 'thanksgiving', 'christmas'
  )),
  closed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (stylist_id, holiday_key)
);

alter table public.stylist_holiday_settings enable row level security;
revoke all on public.stylist_holiday_settings from anon;
grant select, insert, update, delete on public.stylist_holiday_settings to authenticated;

drop policy if exists "Stylists can view own holiday settings" on public.stylist_holiday_settings;
create policy "Stylists can view own holiday settings"
  on public.stylist_holiday_settings for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can add own holiday settings" on public.stylist_holiday_settings;
create policy "Stylists can add own holiday settings"
  on public.stylist_holiday_settings for insert
  to authenticated
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can update own holiday settings" on public.stylist_holiday_settings;
create policy "Stylists can update own holiday settings"
  on public.stylist_holiday_settings for update
  to authenticated
  using ((select auth.uid()) = stylist_id)
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can delete own holiday settings" on public.stylist_holiday_settings;
create policy "Stylists can delete own holiday settings"
  on public.stylist_holiday_settings for delete
  to authenticated
  using ((select auth.uid()) = stylist_id);

-- Is the business closed for a holiday on this date?
create or replace function public.stylist_closed_on(p_stylist_id uuid, p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stylist_holiday_settings s
    join public.us_federal_holidays(extract(year from p_day)::integer) h on h.holiday_key = s.holiday_key
    where s.stylist_id = p_stylist_id
      and s.closed
      and h.holiday_date = p_day
  )
$$;

-- ============ WHAT BLOCKS BOOKINGS (same as step 29, plus closed holidays) ============
-- Used by the booking page's open times, the waitlist, self-serve reschedule
-- and standing appointments, so a closed holiday works everywhere at once.
create or replace function public.calendar_blocks(p_stylist_id uuid, p_start timestamp, p_end timestamp)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.stylist_closed_on(p_stylist_id, p_start::date)
    or exists (
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

-- ============ WHO CAN CALL WHAT ============
revoke execute on function public.calendar_event_on(public.calendar_events, date) from public, anon, authenticated;
revoke execute on function public.calendar_blocks(uuid, timestamp, timestamp) from public, anon, authenticated;
revoke execute on function public.stylist_closed_on(uuid, date) from public, anon, authenticated;
grant execute on function public.nth_weekday(integer, integer, integer, integer) to authenticated;
grant execute on function public.us_federal_holidays(integer) to authenticated;

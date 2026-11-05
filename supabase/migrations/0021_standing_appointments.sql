-- Step 16: standing appointments (part of Regulars First), plus a
-- confirmation email and a 24-hour reminder for every booking.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0020_welcome_email.sql first. Running this again later is safe.
--
-- A standing appointment is a series for one Regular: the same service,
-- day and time every 2 to 12 weeks. The next 3 months of visits are booked
-- (held) as ordinary confirmed bookings, so nobody else can book those times.
-- The every-minute check (Clientele's server) keeps rolling them forward.
--
-- Emails: the every-minute check asks booking_due_emails() which booking
-- emails are due, sends them, then calls booking_mark_email():
--   confirmation - soon after booking (standing visits: 7 days before)
--   reminder     - 24 hours before (if it was booked before that)
-- Each email has a "Cancel this visit" link (bookings.cancel_token).

-- ============ STANDING SERIES ============
create table if not exists public.standing_series (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  interval_weeks smallint not null check (interval_weeks between 2 and 12),
  -- 0 = Sunday ... 6 = Saturday.
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  -- The first visit (always on `weekday`).
  first_date date not null,
  -- The last day a visit can be on. Empty = keeps going.
  end_date date,
  -- 'none': no deposit for these visits. 'each': the service's deposit, paid
  -- by the client from a link in their email before each visit.
  deposit_mode text not null default 'none' check (deposit_mode in ('none', 'each')),
  status text not null default 'active' check (status in ('active', 'ended')),
  -- When the next 3 months were last booked.
  filled_at timestamptz,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint standing_end_after_start check (end_date is null or end_date >= first_date)
);

create index if not exists standing_series_stylist_idx on public.standing_series (stylist_id, status);
create index if not exists standing_series_client_idx on public.standing_series (client_id);

alter table public.standing_series enable row level security;

-- Stylists can see their own series. Changes go through the functions below.
drop policy if exists "Stylists can view own standing series" on public.standing_series;
create policy "Stylists can view own standing series"
  on public.standing_series for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

revoke insert, update, delete on public.standing_series from anon, authenticated;
grant select on public.standing_series to authenticated;

-- Dates a visit couldn't be held because the time was already booked.
-- The every-minute check keeps trying until the stylist dismisses it.
create table if not exists public.standing_clashes (
  series_id uuid not null references public.standing_series (id) on delete cascade,
  standing_date date not null,
  dismissed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (series_id, standing_date)
);

alter table public.standing_clashes enable row level security;

drop policy if exists "Stylists can view own standing clashes" on public.standing_clashes;
create policy "Stylists can view own standing clashes"
  on public.standing_clashes for select
  to authenticated
  using (exists (
    select 1 from public.standing_series s
    where s.id = series_id and s.stylist_id = (select auth.uid())
  ));

revoke insert, update, delete on public.standing_clashes from anon, authenticated;
grant select on public.standing_clashes to authenticated;

-- ============ BOOKINGS: standing visits + emails ============
alter table public.bookings add column if not exists standing_series_id uuid
  references public.standing_series (id) on delete set null;
-- The date in the series this visit is for (it stays the same if it's moved).
alter table public.bookings add column if not exists standing_date date;
-- The stylist looked at a "day off / outside your hours" flag and kept the visit.
alter table public.bookings add column if not exists standing_keep boolean not null default false;
-- The secret in the email's "Cancel this visit" and "Pay your deposit" links.
alter table public.bookings add column if not exists cancel_token text;
alter table public.bookings add column if not exists confirmation_sent_at timestamptz;
alter table public.bookings add column if not exists reminder_sent_at timestamptz;
alter table public.bookings add column if not exists email_failures smallint not null default 0;

create index if not exists bookings_standing_idx
  on public.bookings (standing_series_id, standing_date);

-- Bookings made before this step: no confirmation email now (they're
-- already booked), and no reminder for anything in the next 24 hours.
update public.bookings b
set confirmation_sent_at = coalesce(b.confirmation_sent_at, now()),
    reminder_sent_at = case
      when b.reminder_sent_at is null
        and (b.booking_date + b.start_time) at time zone s.timezone < now() + interval '24 hours'
        then now()
      else b.reminder_sent_at
    end
from public.stylists s
where s.id = b.stylist_id
  and b.cancel_token is null;

update public.bookings
set cancel_token = public.waitlist_token()
where cancel_token is null;

alter table public.bookings alter column cancel_token
  set default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
alter table public.bookings alter column cancel_token set not null;
create unique index if not exists bookings_cancel_token_key on public.bookings (cancel_token);

-- ============ HOLDING THE NEXT 3 MONTHS ============
-- Books every visit of one series (or every series due, when empty) up to
-- 91 days ahead. A series only rolls forward while the stylist has
-- Regulars First and the client is still a Regular. A time that's already
-- taken is noted in standing_clashes and tried again next time.
-- Returns how many visits were booked.
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
            insert into public.standing_clashes (series_id, standing_date)
            values (v_series.id, v_date)
            on conflict do nothing;
        end;
      end if;
      v_date := v_date + v_step;
    end loop;
  end loop;
  return v_held;
end;
$$;

-- ============ THE STYLIST'S CONTROLS ============
-- Make a series for one of the stylist's Regulars, and book the next 3 months.
-- Returns { id, held, clashes }.
create or replace function public.standing_create(
  p_client_id uuid,
  p_service_id uuid,
  p_interval_weeks integer,
  p_weekday integer,
  p_time time,
  p_start_date date,
  p_end_date date default null,
  p_deposit_mode text default 'none'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_stylist public.stylists;
  v_client public.clients;
  v_service public.services;
  v_first date;
  v_id uuid;
  v_held integer;
  v_clashes integer;
begin
  select * into v_stylist from public.stylists where id = v_uid;
  if not found then
    raise exception 'not_found';
  end if;
  if not public.stylist_has_feature(v_uid, 'regulars') then
    raise exception 'plan_regulars_paused';
  end if;

  select * into v_client from public.clients where id = p_client_id and stylist_id = v_uid;
  if not found then
    raise exception 'not_found';
  end if;
  if v_client.status <> 'regular' then
    raise exception 'not_regular';
  end if;

  select * into v_service from public.services where id = p_service_id and stylist_id = v_uid;
  if not found then
    raise exception 'invalid_service';
  end if;
  if p_time + make_interval(mins => v_service.duration_minutes) <= p_time then
    raise exception 'too_late';
  end if;

  if p_interval_weeks is null or p_interval_weeks not between 2 and 12 then
    raise exception 'invalid_interval';
  end if;
  if p_weekday is null or p_weekday not between 0 and 6 or p_time is null then
    raise exception 'invalid_time';
  end if;
  if p_start_date is null or p_start_date < (now() at time zone v_stylist.timezone)::date
     or p_start_date > (now() at time zone v_stylist.timezone)::date + 365 then
    raise exception 'invalid_start';
  end if;
  if p_deposit_mode not in ('none', 'each') then
    raise exception 'invalid_deposit';
  end if;

  -- The first chosen weekday on or after the start date.
  v_first := p_start_date + ((p_weekday - extract(dow from p_start_date)::integer + 7) % 7);
  if p_end_date is not null and p_end_date < v_first then
    raise exception 'invalid_end';
  end if;

  insert into public.standing_series (
    stylist_id, client_id, service_id, interval_weeks, weekday, start_time,
    first_date, end_date, deposit_mode
  )
  values (
    v_uid, v_client.id, v_service.id, p_interval_weeks, p_weekday, p_time,
    v_first, p_end_date, p_deposit_mode
  )
  returning id into v_id;

  v_held := public.standing_fill(v_id);
  select count(*) into v_clashes from public.standing_clashes where series_id = v_id;
  return jsonb_build_object('id', v_id, 'held', v_held, 'clashes', v_clashes);
end;
$$;

-- Skip one visit: it's cancelled, and the time isn't offered to anyone
-- (the stylist can post it as an opening if they want it booked).
create or replace function public.standing_skip(p_booking_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform set_config('clientele.standing_quiet', 'on', true);
  update public.bookings b
  set status = 'cancelled'
  where b.id = p_booking_id
    and b.stylist_id = auth.uid()
    and b.standing_series_id is not null
    and b.status = 'confirmed';
  if not found then
    raise exception 'not_found';
  end if;
  perform set_config('clientele.standing_quiet', 'off', true);
end;
$$;

-- Move one visit to another day or time (the rest of the series stays put).
-- The client gets a new confirmation email, and a new reminder.
create or replace function public.standing_move(p_booking_id uuid, p_date date, p_time time)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_tz text;
begin
  select timezone into v_tz from public.stylists where id = auth.uid();
  if not found then
    raise exception 'not_found';
  end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));

  select * into v_booking from public.bookings
  where id = p_booking_id
    and stylist_id = auth.uid()
    and standing_series_id is not null
    and status = 'confirmed'
  for update;
  if not found then
    raise exception 'not_found';
  end if;
  if p_date is null or p_time is null or p_date + p_time <= now() at time zone v_tz then
    raise exception 'invalid_time';
  end if;
  if p_time + (v_booking.end_time - v_booking.start_time) <= p_time then
    raise exception 'too_late';
  end if;

  begin
    update public.bookings
    set booking_date = p_date,
        start_time = p_time,
        end_time = p_time + (v_booking.end_time - v_booking.start_time),
        standing_keep = false,
        confirmation_sent_at = null,
        reminder_sent_at = null,
        email_failures = 0
    where id = p_booking_id;
  exception
    when exclusion_violation then
      raise exception 'slot_taken';
  end;
end;
$$;

-- End a series: no more visits are booked, and the upcoming ones are cancelled.
-- Returns how many upcoming visits were cancelled.
create or replace function public.standing_end(p_series_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.standing_series
  set status = 'ended', ended_at = now()
  where id = p_series_id and stylist_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'not_found';
  end if;

  perform set_config('clientele.standing_quiet', 'on', true);
  update public.bookings b
  set status = 'cancelled'
  from public.stylists s
  where s.id = b.stylist_id
    and b.standing_series_id = p_series_id
    and b.status = 'confirmed'
    and b.booking_date + b.start_time > now() at time zone s.timezone;
  get diagnostics v_count = row_count;
  perform set_config('clientele.standing_quiet', 'off', true);

  delete from public.standing_clashes where series_id = p_series_id;
  return v_count;
end;
$$;

-- The stylist saw a flag on the Today page and dealt with it:
--   a clash ("time already booked"): stop trying that date
--   a visit on a day off / outside their hours: keep it as it is
create or replace function public.standing_dismiss(
  p_series_id uuid default null,
  p_date date default null,
  p_booking_id uuid default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_booking_id is not null then
    update public.bookings
    set standing_keep = true
    where id = p_booking_id and stylist_id = auth.uid() and standing_series_id is not null;
  else
    update public.standing_clashes c
    set dismissed = true
    from public.standing_series s
    where s.id = c.series_id
      and s.stylist_id = auth.uid()
      and c.series_id = p_series_id
      and c.standing_date = p_date;
  end if;
end;
$$;

-- What needs a look on the Today page (standing visits only):
--   clash          - the time was already booked, so the visit isn't held
--   day_off        - the visit is on a blocked date
--   not_working    - the visit is on a day the stylist doesn't work
--   outside_hours  - the visit starts or ends outside their working hours
--   deposit_unpaid - a deposit is still unpaid with 48 hours or less to go
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
      ) as blocked
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
      when v.is_working = false then 'not_working'
      else 'outside_hours'
    end,
    v.id, v.standing_series_id, v.client_name, v.service_name,
    v.booking_date, v.start_time, v.end_time, v.deposit_cents
  from visits v
  where not v.standing_keep
    and (
      v.blocked
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
  select 'clash', null, ss.id, c.name, sv.name, sc.standing_date, ss.start_time,
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

-- ============ A CLIENT CANCELS ONE STANDING VISIT ============
-- The time opens up like any cancellation: if it isn't inside one of the
-- stylist's openings, an "Everyone" opening is added for it, so the waitlist
-- (and the booking page) can offer it. Skipping or ending a series doesn't
-- do this.
create or replace function public.bookings_open_standing_time()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('clientele.standing_quiet', true), '') = 'on' then
    return null;
  end if;
  if exists (
    select 1 from public.blocked_dates bd
    where bd.stylist_id = new.stylist_id and bd.blocked_on = new.booking_date
  ) or exists (
    select 1 from public.openings o
    where o.stylist_id = new.stylist_id
      and o.opening_date = new.booking_date
      and o.start_time < new.end_time
      and o.end_time > new.start_time
  ) then
    return null;
  end if;
  begin
    insert into public.openings (stylist_id, opening_date, start_time, end_time, visibility)
    values (new.stylist_id, new.booking_date, new.start_time, new.end_time, 'everyone');
  exception
    when exclusion_violation then null;
  end;
  return null;
end;
$$;

drop trigger if exists bookings_open_standing_time on public.bookings;
create trigger bookings_open_standing_time
  after update of status on public.bookings
  for each row
  when (
    new.standing_series_id is not null
    and old.status = 'confirmed'
    and new.status = 'cancelled'
  )
  execute function public.bookings_open_standing_time();

-- ============ THE EMAIL LINKS ============
-- "Cancel this visit": the same rules as cancelling from the booking page
-- (a confirmed booking that hasn't started; deposits aren't refunded
-- automatically). Returns the same details as cancel_my_booking.
create or replace function public.cancel_booking_by_token(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  if coalesce(p_token, '') = '' then
    raise exception 'not_found';
  end if;

  update public.bookings b
  set status = 'cancelled'
  from public.stylists s
  where b.cancel_token = p_token
    and s.id = b.stylist_id
    and b.status = 'confirmed'
    and b.booking_date + b.start_time > now() at time zone s.timezone
  returning b.* into v_booking;

  if v_booking.id is null then
    raise exception 'not_found';
  end if;

  return jsonb_build_object(
    'id', v_booking.id,
    'stylist_id', v_booking.stylist_id,
    'client_name', v_booking.client_name,
    'client_phone', v_booking.client_phone,
    'service_name', v_booking.service_name,
    'booking_date', v_booking.booking_date,
    'start_time', v_booking.start_time,
    'deposit_cents', v_booking.deposit_cents,
    'deposit_status', v_booking.deposit_status
  );
end;
$$;

-- "Pay your deposit" on a standing visit that's already booked: the
-- payment marks it paid. (Everything else works as in step 5.)
create or replace function public.confirm_deposit_payment(
  p_booking_id uuid,
  p_session_id text,
  p_payment_intent_id text
)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stylist_id uuid;
  v_booking public.bookings;
begin
  select stylist_id into v_stylist_id from public.bookings where id = p_booking_id;
  if not found then
    return 'not_found';
  end if;

  -- Same lock as create_booking, so confirming can't race a new booking.
  perform pg_advisory_xact_lock(hashtext(v_stylist_id::text));

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.stripe_checkout_session_id is distinct from p_session_id then
    return 'not_found';
  end if;
  if v_booking.deposit_status = 'refunded' then
    return 'already_refunded';
  end if;
  if v_booking.deposit_status = 'refund_pending' then
    return 'refund';
  end if;
  if v_booking.status = 'confirmed' and v_booking.deposit_status = 'paid' then
    return 'already_confirmed';
  end if;

  -- A standing visit (already booked) whose deposit was just paid.
  if v_booking.status = 'confirmed' and v_booking.deposit_status = 'unpaid' then
    update public.bookings
    set deposit_status = 'paid',
        deposit_paid_at = now(),
        stripe_payment_intent_id = p_payment_intent_id
    where id = p_booking_id;
    return 'confirmed';
  end if;

  if v_booking.status in ('pending_payment', 'expired') then
    begin
      update public.bookings
      set status = 'confirmed',
          deposit_status = 'paid',
          deposit_paid_at = now(),
          stripe_payment_intent_id = p_payment_intent_id
      where id = p_booking_id;
      return 'confirmed';
    exception
      when exclusion_violation then
        null; -- The hold ran out and someone else booked the time.
    end;
  end if;

  update public.bookings
  set deposit_status = 'refund_pending',
      deposit_paid_at = now(),
      stripe_payment_intent_id = p_payment_intent_id
  where id = p_booking_id;
  return 'refund';
end;
$$;

-- ============ CONFIRMATION AND REMINDER EMAILS ============
-- Which emails are due right now (at most 100 at a time).
create or replace function public.booking_due_emails()
returns table (
  booking_id uuid,
  kind text,
  stylist_id uuid,
  slug text,
  business_name text,
  timezone text,
  client_name text,
  client_email text,
  service_name text,
  booking_date date,
  start_time time,
  end_time time,
  price_cents integer,
  deposit_cents integer,
  deposit_status text,
  cancellation_policy text,
  cancel_token text,
  standing boolean,
  interval_weeks smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  with due as (
    select b.*, s.slug, s.business_name, s.timezone,
      (b.booking_date + b.start_time) at time zone s.timezone as starts_at
    from public.bookings b
    join public.stylists s on s.id = b.stylist_id
    where b.status = 'confirmed'
      and b.client_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
      and b.email_failures < 5
      and (b.confirmation_sent_at is null or b.reminder_sent_at is null)
      and b.booking_date >= (now() at time zone s.timezone)::date - 1
  )
  select d.id,
    case
      when d.reminder_sent_at is null
        and d.starts_at <= now() + interval '24 hours'
        and d.created_at < d.starts_at - interval '24 hours'
        then 'reminder'
      else 'confirmation'
    end,
    d.stylist_id, d.slug, d.business_name, d.timezone, d.client_name, d.client_email,
    d.service_name, d.booking_date, d.start_time, d.end_time, d.price_cents,
    d.deposit_cents, d.deposit_status, d.cancellation_policy, d.cancel_token,
    d.standing_series_id is not null,
    (select ss.interval_weeks from public.standing_series ss where ss.id = d.standing_series_id)
  from due d
  where d.starts_at > now()
    and (
      -- The 24-hour reminder (only if it was booked before then).
      (d.reminder_sent_at is null
        and d.starts_at <= now() + interval '24 hours'
        and d.created_at < d.starts_at - interval '24 hours')
      -- The confirmation. Standing visits get theirs a week ahead.
      or (d.confirmation_sent_at is null
        and (d.standing_series_id is null or d.starts_at <= now() + interval '7 days'))
    )
  order by d.starts_at
  limit 100
$$;

-- Notes that an email was sent (p_ok) or failed (tried up to 5 times).
-- p_kind: 'confirmation' or 'reminder'. A reminder also counts as the
-- confirmation, and once a reminder is too late to send, it isn't sent.
create or replace function public.booking_mark_email(p_booking_id uuid, p_kind text, p_ok boolean default true)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.bookings b
  set confirmation_sent_at = case
        when p_ok then coalesce(b.confirmation_sent_at, now())
        else b.confirmation_sent_at
      end,
      reminder_sent_at = case
        when p_ok and (
          p_kind = 'reminder'
          -- Booked within 24 hours of the visit: the confirmation is enough.
          or b.created_at >= (b.booking_date + b.start_time) at time zone s.timezone - interval '24 hours'
        ) then coalesce(b.reminder_sent_at, now())
        else b.reminder_sent_at
      end,
      email_failures = case when p_ok then 0 else b.email_failures + 1 end
  from public.stylists s
  where b.id = p_booking_id and s.id = b.stylist_id
$$;

-- ============ WHO CAN CALL WHAT ============
revoke execute on function public.standing_fill(uuid) from public, anon, authenticated;
revoke execute on function public.bookings_open_standing_time() from public, anon, authenticated;
revoke execute on function public.cancel_booking_by_token(text) from public, anon, authenticated;
revoke execute on function public.booking_due_emails() from public, anon, authenticated;
revoke execute on function public.booking_mark_email(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.confirm_deposit_payment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.standing_fill(uuid) to service_role;
grant execute on function public.cancel_booking_by_token(text) to service_role;
grant execute on function public.booking_due_emails() to service_role;
grant execute on function public.booking_mark_email(uuid, text, boolean) to service_role;
grant execute on function public.confirm_deposit_payment(uuid, text, text) to service_role;

-- The stylist's dashboard (logged in).
revoke execute on function public.standing_create(uuid, uuid, integer, integer, time, date, date, text) from public, anon;
revoke execute on function public.standing_skip(uuid) from public, anon;
revoke execute on function public.standing_move(uuid, date, time) from public, anon;
revoke execute on function public.standing_end(uuid) from public, anon;
revoke execute on function public.standing_dismiss(uuid, date, uuid) from public, anon;
revoke execute on function public.standing_flags() from public, anon;
grant execute on function public.standing_create(uuid, uuid, integer, integer, time, date, date, text) to authenticated;
grant execute on function public.standing_skip(uuid) to authenticated;
grant execute on function public.standing_move(uuid, date, time) to authenticated;
grant execute on function public.standing_end(uuid) to authenticated;
grant execute on function public.standing_dismiss(uuid, date, uuid) to authenticated;
grant execute on function public.standing_flags() to authenticated;

-- ============ BOOKING PAGE: standing visits don't count toward the limit ============
-- Clients can have 3 upcoming appointments booked online. Standing visits
-- the stylist set up don't count, so a Regular with a standing appointment
-- can still book. (Otherwise the same as step 12.)
create or replace function public.create_booking(
  p_slug text,
  p_service_id uuid,
  p_date date,
  p_time time,
  p_name text,
  p_phone text,
  p_email text default null,
  p_invite text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := public.booking_verified_email();
  v_verified_phone text := public.booking_verified_phone();
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_phone_key text;
  v_client_email text;
  v_stylist public.stylists;
  v_service public.services;
  v_status text;
  v_client_id uuid;
  v_upcoming integer;
  v_booking_id uuid;
  v_end time;
  v_deposit integer;
  v_booking_status text;
  v_invite public.client_invites;
  v_invite_id uuid;
  v_match_status text;
begin
  if v_email is null and v_verified_phone is null then
    raise exception 'not_verified';
  end if;
  if char_length(v_name) not between 1 and 100 then
    raise exception 'invalid_name';
  end if;

  if v_verified_phone is not null then
    -- Always the number they proved. Keep how the page wrote it if it matches.
    if public.phone_key(v_phone) is distinct from v_verified_phone or char_length(v_phone) > 30 then
      v_phone := '+' || v_verified_phone;
    end if;
    v_phone_key := v_verified_phone;
    v_client_email := coalesce(v_email, nullif(lower(trim(coalesce(p_email, ''))), ''));
    if v_client_email is not null
      and (char_length(v_client_email) > 254 or v_client_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') then
      raise exception 'invalid_email';
    end if;
  else
    v_phone_key := public.phone_key(v_phone);
    if v_phone_key is null or char_length(v_phone) > 30 then
      raise exception 'invalid_phone';
    end if;
    v_client_email := v_email;
  end if;

  select * into v_stylist from public.stylists where slug = lower(p_slug);
  if not found then
    raise exception 'not_found';
  end if;

  select * into v_service from public.services
  where id = p_service_id and stylist_id = v_stylist.id;
  if not found then
    raise exception 'not_found';
  end if;

  -- One booking at a time per stylist, so the checks below can't race.
  perform pg_advisory_xact_lock(hashtext(v_stylist.id::text));

  -- Release unpaid holds that ran out of time, plus this client's own unpaid
  -- holds (they left the payment page and are starting again).
  update public.bookings
  set status = 'expired'
  where stylist_id = v_stylist.id
    and status = 'pending_payment'
    and (
      hold_expires_at <= now()
      or booked_by = auth.uid()
      or (booked_by is null and lower(client_email) = v_email)
    );

  perform public.apply_auto_regulars(v_stylist.id);
  -- Regular, New... or 'invited' when they came with a working invite link.
  v_status := public.booking_access(v_stylist.id, p_invite);

  -- Clients are matched by phone number. Someone who confirmed by email but
  -- books with a different number than the client with that email is a
  -- different person: not that client, so an invite link can apply to them.
  if v_verified_phone is null and v_status <> 'blocked' then
    if p_invite is not null then
      v_invite := public.booking_find_invite(v_stylist.id, p_invite);
    end if;

    -- An invite made out to the phone number they're booking with says who
    -- they are (a new client), even if their email is on another client's
    -- card. Unless that number already belongs to a Regular.
    if v_invite.id is not null
      and public.phone_key(v_invite.phone) = v_phone_key
      and not exists (
        select 1 from public.clients c
        where c.stylist_id = v_stylist.id
          and c.status = 'regular'
          and public.phone_key(c.phone) = v_phone_key
      ) then
      v_status := 'invited';
    else
      select c.status into v_match_status
      from public.clients c
      where c.stylist_id = v_stylist.id
        and c.status <> 'blocked'
        and public.client_match(c, null, v_email, v_phone_key)
      order by case c.status when 'regular' then 0 else 1 end
      limit 1;

      v_status := case
        when v_match_status = 'regular' then 'regular'
        when v_invite.id is not null then 'invited'
        else coalesce(v_match_status, 'unknown')
      end;
    end if;
  end if;

  if v_status = 'invited' then
    v_invite := public.booking_find_invite(v_stylist.id, p_invite);
    -- An invite made out to a phone number only works for that number.
    if v_invite.phone is not null and public.phone_key(v_invite.phone) is distinct from v_phone_key then
      raise exception 'invite_wrong_person';
    end if;
    v_invite_id := v_invite.id;
  end if;

  -- A blocked client's phone number or email also blocks, even if typed
  -- rather than proved. (Typing one can only ever stop a booking; it never
  -- makes someone a regular.)
  if v_status = 'blocked' or exists (
    select 1 from public.clients c
    where c.stylist_id = v_stylist.id
      and c.status = 'blocked'
      and (
        public.phone_key(c.phone) = v_phone_key
        or (v_client_email is not null and lower(c.email) = v_client_email)
      )
  ) then
    raise exception 'blocked';
  end if;

  if not exists (
    select 1
    from public.booking_open_slots(v_stylist.id, v_service.duration_minutes, v_status) o
    where o.slot_date = p_date and o.slot_time = p_time
  ) then
    raise exception 'slot_unavailable';
  end if;

  select count(*) into v_upcoming
  from public.bookings b
  where b.stylist_id = v_stylist.id
    and (b.booked_by = auth.uid() or (b.booked_by is null and lower(b.client_email) = v_email))
    and b.status = 'confirmed'
    and b.standing_series_id is null
    and b.booking_date + b.start_time > now() at time zone v_stylist.timezone;
  if v_upcoming >= 3 then
    raise exception 'too_many_bookings';
  end if;

  -- Find them on the client list by phone number (see client_match), or add
  -- them as New. Invited clients are matched by phone number only, so their
  -- booking never lands on someone else's card that shares their email.
  select c.id into v_client_id
  from public.clients c
  where c.stylist_id = v_stylist.id
    and case
      when v_status = 'invited' then public.phone_key(c.phone) = v_phone_key
      else public.client_match(c, v_verified_phone, v_email, v_phone_key)
    end
  order by case c.status when 'regular' then 0 else 1 end
  limit 1;

  if v_client_id is null then
    insert into public.clients (stylist_id, name, phone, email, status)
    values (v_stylist.id, v_name, v_phone, v_client_email, 'new')
    returning id into v_client_id;
  end if;

  -- They came with an invite: they show as Invited on the Clients tab.
  if v_invite_id is not null then
    update public.clients
    set invited_at = coalesce(invited_at, now()),
        invite_id = coalesce(invite_id, v_invite_id)
    where id = v_client_id;
  end if;

  v_end := p_time + make_interval(mins => v_service.duration_minutes);
  v_deposit := public.service_deposit_cents(v_stylist, v_service);
  v_booking_status := case when v_deposit > 0 then 'pending_payment' else 'confirmed' end;

  insert into public.bookings (
    stylist_id, service_id, client_id, service_name, price_cents,
    booking_date, start_time, end_time, client_name, client_email, client_phone,
    status, deposit_cents, deposit_status, hold_expires_at, cancellation_policy, booked_by,
    invite_id
  )
  values (
    v_stylist.id, v_service.id, v_client_id, v_service.name, v_service.price_cents,
    p_date, p_time, v_end, v_name, v_client_email, v_phone,
    v_booking_status,
    v_deposit,
    case when v_deposit > 0 then 'unpaid' else 'none' end,
    -- Stripe's payment page is open for 31 minutes; a few spare minutes
    -- let a payment that finishes right at the end still go through.
    case when v_deposit > 0 then now() + interval '35 minutes' end,
    v_stylist.cancellation_policy,
    auth.uid(),
    v_invite_id
  )
  returning id into v_booking_id;

  return jsonb_build_object(
    'id', v_booking_id,
    'status', v_booking_status,
    'deposit_cents', v_deposit,
    'business_name', v_stylist.business_name,
    'service_name', v_service.name,
    'booking_date', p_date,
    'start_time', p_time,
    'end_time', v_end
  );
exception
  when exclusion_violation then
    raise exception 'slot_unavailable';
end;
$$;

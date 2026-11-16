-- Step 25: clients can move (reschedule) their own booking.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0029_visit_notes.sql first. Running this again later is safe.
--
-- A client can move an upcoming booking to another open time for the same
-- service, from "Your upcoming appointments" on the booking page or from the
-- "Reschedule" link in their emails. The booking keeps its id and its
-- deposit (Stripe isn't touched). The rules are the booking page's own:
-- open times, days off, blocked dates, and "Regulars only" times only for
-- Regulars. Also:
--   * not within the business's notice period (Settings, 24 hours to start)
--   * at most 2 moves per booking
--   * a standing visit moves on its own, not the series
--   * past and cancelled bookings can't be moved
-- The old time opens up again (the waitlist hears about it), and the
-- 24-hour reminder follows the new time.

-- ============ COLUMNS ============
alter table public.bookings add column if not exists reschedule_count integer not null default 0;
alter table public.bookings add column if not exists original_start_at timestamptz;
alter table public.bookings add column if not exists rescheduled_at timestamptz;

-- How close to a visit clients can still move it themselves (hours).
-- 0 = any time until it starts.
alter table public.stylists add column if not exists reschedule_cutoff_hours integer not null default 24;
alter table public.stylists drop constraint if exists stylists_reschedule_cutoff_hours_check;
alter table public.stylists add constraint stylists_reschedule_cutoff_hours_check
  check (reschedule_cutoff_hours between 0 and 168);

grant update (reschedule_cutoff_hours) on public.stylists to authenticated;

-- ============ THE RULES ============
-- Why a booking can't be moved by its client right now, or null if it can:
-- 'not_found' (not upcoming and confirmed), 'too_close' (within the notice
-- period), 'too_many' (moved twice already).
create or replace function public.reschedule_blocked(b public.bookings)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when b.status <> 'confirmed' then 'not_found'
    when b.booking_date + b.start_time <= now() at time zone s.timezone then 'not_found'
    when b.reschedule_count >= 2 then 'too_many'
    when b.booking_date + b.start_time
         < (now() at time zone s.timezone) + make_interval(hours => s.reschedule_cutoff_hours)
      then 'too_close'
    else null
  end
  from public.stylists s
  where s.id = b.stylist_id
$$;

-- Who the client is for the booking page's rules: 'regular', 'blocked',
-- 'invited' (came with an invite link) or 'new'. From their client card.
create or replace function public.reschedule_viewer(b public.bookings)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case
        when c.status = 'regular' then 'regular'
        when c.status = 'blocked' then 'blocked'
        when b.invite_id is not null or c.invited_at is not null then 'invited'
        else 'new'
      end
      from public.clients c
      where c.id = b.client_id
    ),
    case when b.invite_id is not null then 'invited' else 'new' end
  )
$$;

-- The open times this booking could move to (same service length).
create or replace function public.reschedule_slots_for(p_booking_id uuid)
returns table (slot_date date, slot_time time, visibility text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_reason text;
begin
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'not_found';
  end if;
  v_reason := public.reschedule_blocked(v_booking);
  if v_reason is not null then
    raise exception '%', v_reason;
  end if;

  return query
  select o.slot_date, o.slot_time, o.visibility
  from public.booking_open_slots(
    v_booking.stylist_id,
    (extract(epoch from (v_booking.end_time - v_booking.start_time)) / 60)::integer,
    public.reschedule_viewer(v_booking)
  ) o
  where not (o.slot_date = v_booking.booking_date and o.slot_time = v_booking.start_time)
  order by o.slot_date, o.slot_time;
end;
$$;

-- Moves one booking. The checks and the move happen together, with the
-- business's bookings locked, so two people can't take the same time.
-- Returns what the emails need.
create or replace function public.reschedule_move(p_booking_id uuid, p_date date, p_time time)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_stylist public.stylists;
  v_reason text;
  v_viewer text;
  v_visibility text;
  v_minutes integer;
  v_old_date date;
  v_old_start time;
  v_old_end time;
begin
  select s.* into v_stylist
  from public.stylists s
  join public.bookings b on b.stylist_id = s.id
  where b.id = p_booking_id;
  if not found then
    raise exception 'not_found';
  end if;

  -- One booking change at a time per business (as the booking page does).
  perform pg_advisory_xact_lock(hashtext(v_stylist.id::text));

  select * into v_booking from public.bookings where id = p_booking_id for update;
  v_reason := public.reschedule_blocked(v_booking);
  if v_reason is not null then
    raise exception '%', v_reason;
  end if;

  v_viewer := public.reschedule_viewer(v_booking);
  if v_viewer = 'blocked' then
    raise exception 'blocked';
  end if;
  if p_date is null or p_time is null
    or (p_date = v_booking.booking_date and p_time = v_booking.start_time) then
    raise exception 'slot_unavailable';
  end if;

  v_minutes := (extract(epoch from (v_booking.end_time - v_booking.start_time)) / 60)::integer;
  select o.visibility into v_visibility
  from public.booking_open_slots(v_stylist.id, v_minutes, v_viewer) o
  where o.slot_date = p_date and o.slot_time = p_time;
  if not found then
    raise exception 'slot_unavailable';
  end if;

  v_old_date := v_booking.booking_date;
  v_old_start := v_booking.start_time;
  v_old_end := v_booking.end_time;

  -- A Regulars-only time stays Regulars-only once it's free again
  -- (the same as when a Regulars booking is cancelled).
  if v_booking.regulars_only then
    insert into public.regulars_holds (stylist_id, hold_date, start_time, end_time)
    values (v_stylist.id, v_old_date, v_old_start, v_old_end);
  end if;

  update public.bookings
  set booking_date = p_date,
      start_time = p_time,
      end_time = p_time + make_interval(mins => v_minutes),
      regulars_only = (v_visibility = 'regulars'),
      reschedule_count = reschedule_count + 1,
      original_start_at = coalesce(
        original_start_at,
        (v_old_date + v_old_start) at time zone v_stylist.timezone
      ),
      rescheduled_at = now(),
      -- The "moved" email is the new confirmation; the reminder follows
      -- the new time.
      confirmation_sent_at = coalesce(confirmation_sent_at, now()),
      reminder_sent_at = null,
      email_failures = 0,
      standing_keep = false
  where id = p_booking_id
  returning * into v_booking;

  return jsonb_build_object(
    'id', v_booking.id,
    'stylist_id', v_stylist.id,
    'slug', v_stylist.slug,
    'business_name', v_stylist.business_name,
    'timezone', v_stylist.timezone,
    'client_name', v_booking.client_name,
    'client_email', v_booking.client_email,
    'client_phone', v_booking.client_phone,
    'service_name', v_booking.service_name,
    'price_cents', v_booking.price_cents,
    'deposit_cents', v_booking.deposit_cents,
    'deposit_status', v_booking.deposit_status,
    'cancellation_policy', v_booking.cancellation_policy,
    'cancel_token', v_booking.cancel_token,
    'standing', v_booking.standing_series_id is not null,
    'reschedule_count', v_booking.reschedule_count,
    'old_date', v_old_date,
    'old_start', v_old_start,
    'booking_date', v_booking.booking_date,
    'start_time', v_booking.start_time,
    'end_time', v_booking.end_time
  );
exception
  when exclusion_violation then
    raise exception 'slot_unavailable';
end;
$$;

-- ============ FROM THE BOOKING PAGE (the client's own login) ============
-- The same "is this theirs?" rule as cancelling there.
create or replace function public.my_booking_id(p_slug text, p_booking_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select b.id
  from public.bookings b
  join public.stylists s on s.id = b.stylist_id
  where b.id = p_booking_id
    and s.slug = lower(p_slug)
    and auth.uid() is not null
    and (
      b.booked_by = auth.uid()
      or (b.booked_by is null and lower(b.client_email) = public.booking_verified_email())
    )
$$;

create or replace function public.get_my_reschedule_slots(p_slug text, p_booking_id uuid)
returns table (slot_date date, slot_time time, visibility text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.my_booking_id(p_slug, p_booking_id);
begin
  if v_id is null then
    raise exception 'not_found';
  end if;
  return query select * from public.reschedule_slots_for(v_id);
end;
$$;

create or replace function public.reschedule_my_booking(p_slug text, p_booking_id uuid, p_date date, p_time time)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.my_booking_id(p_slug, p_booking_id);
begin
  if v_id is null then
    raise exception 'not_found';
  end if;
  return public.reschedule_move(v_id, p_date, p_time);
end;
$$;

-- "Your upcoming appointments", now saying whether each can be moved
-- (can_reschedule) and why not (reschedule_reason: too_close / too_many).
drop function if exists public.get_my_bookings(text);
create function public.get_my_bookings(p_slug text)
returns table (
  id uuid,
  service_name text,
  booking_date date,
  start_time time,
  end_time time,
  deposit_cents integer,
  deposit_status text,
  can_reschedule boolean,
  reschedule_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.service_name, b.booking_date, b.start_time, b.end_time, b.deposit_cents, b.deposit_status,
    public.reschedule_blocked(b) is null,
    public.reschedule_blocked(b)
  from public.stylists s
  join public.bookings b on b.stylist_id = s.id
  where s.slug = lower(p_slug)
    and auth.uid() is not null
    and (
      b.booked_by = auth.uid()
      -- Bookings from before step 6 have no booked_by.
      or (b.booked_by is null and lower(b.client_email) = public.booking_verified_email())
    )
    and b.status = 'confirmed'
    and b.booking_date + b.start_time > now() at time zone s.timezone
  order by b.booking_date, b.start_time
$$;

-- ============ FROM THE EMAIL LINK (the booking's secret token) ============
-- Called by Clientele's server only, like cancel_booking_by_token.
create or replace function public.reschedule_slots_by_token(p_token text)
returns table (slot_date date, slot_time time, visibility text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select b.id into v_id from public.bookings b
  where coalesce(p_token, '') <> '' and b.cancel_token = p_token;
  if v_id is null then
    raise exception 'not_found';
  end if;
  return query select * from public.reschedule_slots_for(v_id);
end;
$$;

create or replace function public.reschedule_booking_by_token(p_token text, p_date date, p_time time)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select b.id into v_id from public.bookings b
  where coalesce(p_token, '') <> '' and b.cancel_token = p_token;
  if v_id is null then
    raise exception 'not_found';
  end if;
  return public.reschedule_move(v_id, p_date, p_time);
end;
$$;

-- ============ EMAILS: the reminder follows a moved visit ============
-- The same as step 16, except "booked more than 24 hours ahead" counts from
-- when it was last moved, so moving a visit to tomorrow doesn't send a
-- reminder straight after the "moved" email.
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
      (b.booking_date + b.start_time) at time zone s.timezone as starts_at,
      greatest(b.created_at, coalesce(b.rescheduled_at, b.created_at)) as set_at
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
        and d.set_at < d.starts_at - interval '24 hours'
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
      -- The 24-hour reminder (only if it was booked or moved before then).
      (d.reminder_sent_at is null
        and d.starts_at <= now() + interval '24 hours'
        and d.set_at < d.starts_at - interval '24 hours')
      -- The confirmation. Standing visits get theirs a week ahead.
      or (d.confirmation_sent_at is null
        and (d.standing_series_id is null or d.starts_at <= now() + interval '7 days'))
    )
  order by d.starts_at
  limit 100
$$;

-- ============ WHO CAN CALL WHAT ============
revoke execute on function public.reschedule_blocked(public.bookings) from public, anon, authenticated;
revoke execute on function public.reschedule_viewer(public.bookings) from public, anon, authenticated;
revoke execute on function public.reschedule_slots_for(uuid) from public, anon, authenticated;
revoke execute on function public.reschedule_move(uuid, date, time) from public, anon, authenticated;
revoke execute on function public.my_booking_id(text, uuid) from public, anon, authenticated;

revoke execute on function public.get_my_reschedule_slots(text, uuid) from public;
revoke execute on function public.reschedule_my_booking(text, uuid, date, time) from public;
revoke execute on function public.get_my_bookings(text) from public;
grant execute on function public.get_my_reschedule_slots(text, uuid) to anon, authenticated;
grant execute on function public.reschedule_my_booking(text, uuid, date, time) to anon, authenticated;
grant execute on function public.get_my_bookings(text) to anon, authenticated;

revoke execute on function public.reschedule_slots_by_token(text) from public, anon, authenticated;
revoke execute on function public.reschedule_booking_by_token(text, date, time) from public, anon, authenticated;
grant execute on function public.reschedule_slots_by_token(text) to service_role;
grant execute on function public.reschedule_booking_by_token(text, date, time) to service_role;

revoke execute on function public.booking_due_emails() from public, anon, authenticated;
grant execute on function public.booking_due_emails() to service_role;

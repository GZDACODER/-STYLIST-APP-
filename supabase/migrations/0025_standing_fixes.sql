-- Step 20: two standing appointment fixes from testing.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0021_standing_appointments.sql first. Running this again later is safe.
--
-- 1. A client can't have two standing appointments on the same day and time
--    (the second one would only clash with the first).
-- 2. When a standing appointment is set up, the client gets one email
--    straight away ("Your standing appointment": how often, the day and time,
--    and the next dates), instead of waiting until a week before the first
--    visit. The usual reminders still follow.

-- When the "set up" email went out. Series that exist already count as sent,
-- so nobody gets a surprise email.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'standing_series' and column_name = 'setup_email_sent_at'
  ) then
    alter table public.standing_series add column setup_email_sent_at timestamptz;
    update public.standing_series set setup_email_sent_at = now();
  end if;
end;
$$;

-- ============ 1. NO DUPLICATE SERIES ============
-- Otherwise the same as step 16.
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

  -- One standing appointment per client per day and time.
  if exists (
    select 1 from public.standing_series ss
    where ss.stylist_id = v_uid
      and ss.client_id = v_client.id
      and ss.status = 'active'
      and ss.weekday = p_weekday
      and ss.start_time = p_time
  ) then
    raise exception 'duplicate_series';
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

-- Who needs the "set up" email: active series with a client email, at least
-- one upcoming held visit, and no email yet. next_dates: up to 3 upcoming
-- visits [{ date, time, cancel_token }].
create or replace function public.standing_setup_due()
returns table (
  series_id uuid,
  stylist_id uuid,
  slug text,
  business_name text,
  timezone text,
  client_name text,
  client_email text,
  service_name text,
  interval_weeks smallint,
  weekday smallint,
  start_time time,
  deposit_mode text,
  next_dates jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select ss.id, s.id, s.slug, s.business_name, s.timezone, c.name, lower(c.email), sv.name,
    ss.interval_weeks, ss.weekday, ss.start_time, ss.deposit_mode,
    (
      select jsonb_agg(jsonb_build_object('date', n.booking_date, 'time', n.start_time, 'cancel_token', n.cancel_token)
        order by n.booking_date)
      from (
        select b.booking_date, b.start_time, b.cancel_token
        from public.bookings b
        where b.standing_series_id = ss.id
          and b.status = 'confirmed'
          and b.booking_date + b.start_time > now() at time zone s.timezone
        order by b.booking_date
        limit 3
      ) n
    )
  from public.standing_series ss
  join public.stylists s on s.id = ss.stylist_id
  join public.clients c on c.id = ss.client_id
  join public.services sv on sv.id = ss.service_id
  where ss.status = 'active'
    and ss.setup_email_sent_at is null
    and coalesce(c.email, '') ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    and exists (
      select 1 from public.bookings b
      where b.standing_series_id = ss.id
        and b.status = 'confirmed'
        and b.booking_date + b.start_time > now() at time zone s.timezone
    )
  limit 50
$$;

-- Notes the "set up" email went out. It covers the confirmation for any
-- visit in the next 7 days, so those don't get a second email (the 24-hour
-- reminder still comes).
create or replace function public.standing_setup_mark(p_series_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.standing_series set setup_email_sent_at = now() where id = p_series_id;
  update public.bookings b
  set confirmation_sent_at = coalesce(b.confirmation_sent_at, now())
  from public.stylists s
  where b.standing_series_id = p_series_id
    and s.id = b.stylist_id
    and b.status = 'confirmed'
    and (b.booking_date + b.start_time) at time zone s.timezone <= now() + interval '7 days';
$$;

revoke execute on function public.standing_setup_due() from public, anon, authenticated;
revoke execute on function public.standing_setup_mark(uuid) from public, anon, authenticated;
grant execute on function public.standing_setup_due() to service_role;
grant execute on function public.standing_setup_mark(uuid) to service_role;

-- Step 21: make duplicate standing appointments impossible.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0025_standing_fixes.sql first, and end any duplicate standing
-- appointments first (this file stops and says so if there are any).
-- Running this again later is safe.
--
-- Step 20's check only compared the client card. The same person can have
-- two cards (one added by hand, one made when they booked online), so a
-- second series on the other card got through. Now:
--   1. the check matches the person: the same card, email or phone number,
--   2. two quick taps can't both get past the check, and
--   3. the database itself refuses two active series on the same card for
--      the same day and time, whatever asks for it.

-- Stop here if duplicates exist, so nothing is half-changed.
do $$
begin
  if exists (
    select 1 from public.standing_series
    where status = 'active'
    group by stylist_id, client_id, weekday, start_time
    having count(*) > 1
  ) then
    raise exception 'There are duplicate standing appointments. End the duplicate first (see the instructions), then run this again.';
  end if;
end;
$$;

create unique index if not exists standing_series_one_per_slot
  on public.standing_series (stylist_id, client_id, weekday, start_time)
  where status = 'active';

-- ============ THE CHECK, BY PERSON ============
-- Otherwise the same as step 20.
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

  -- One set-up at a time per business, so two quick taps can't both pass
  -- the check below. (The same lock the booking page uses.)
  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  -- One standing appointment per person per day and time. The same person
  -- can have more than one client card (one made by hand, one made when
  -- they booked online), so cards with the same email or phone count too.
  if exists (
    select 1
    from public.standing_series ss
    join public.clients oc on oc.id = ss.client_id
    where ss.stylist_id = v_uid
      and ss.status = 'active'
      and ss.weekday = p_weekday
      and ss.start_time = p_time
      and (
        oc.id = v_client.id
        or (nullif(lower(trim(oc.email)), '') is not null
            and lower(trim(oc.email)) = lower(trim(v_client.email)))
        or (public.phone_key(oc.phone) is not null
            and public.phone_key(oc.phone) = public.phone_key(v_client.phone))
      )
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


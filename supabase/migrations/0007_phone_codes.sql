-- Step 6: clients confirm with a text message code (email still works),
-- are matched to the client list by phone number, and become Regulars
-- automatically after a set number of completed appointments.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Running it again later is safe.

-- ============ PHONE NUMBERS ============

-- One way of writing each number, so "(555) 123-4567", "555.123.4567" and
-- "+1 555 123 4567" all match. US numbers (10 digits) get a leading 1, the
-- same way Supabase stores phone logins ("15551234567"). Too short = null.
create or replace function public.phone_key(p_phone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when char_length(d) < 8 then null
    when char_length(d) = 10 then '1' || d
    else d
  end
  from (select regexp_replace(coalesce(p_phone, ''), '\D', '', 'g') as d) x
$$;

create index if not exists clients_phone_key_idx
  on public.clients (stylist_id, public.phone_key(phone));

-- ============ AUTOMATIC REGULARS ============

-- After this many completed appointments, a New client becomes a Regular.
-- 0 means never (the stylist picks Regulars by hand).
alter table public.stylists add column if not exists auto_regular_after integer not null default 3;
alter table public.stylists drop constraint if exists stylists_auto_regular_after_check;
alter table public.stylists add constraint stylists_auto_regular_after_check
  check (auto_regular_after between 0 and 50);

grant update (auto_regular_after) on public.stylists to authenticated;

-- False once the stylist moves a client off Regular by hand, so the app
-- doesn't make them a Regular again behind the stylist's back.
alter table public.clients add column if not exists auto_regular boolean not null default true;

create or replace function public.clients_track_manual_demotion()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'regular' and new.status <> 'regular' then
    new.auto_regular := false;
  end if;
  return new;
end;
$$;

drop trigger if exists clients_track_manual_demotion on public.clients;
create trigger clients_track_manual_demotion
  before update of status on public.clients
  for each row execute function public.clients_track_manual_demotion();

-- Appointments this client has finished (confirmed, and the end time has
-- passed). Cancelled and unpaid ones don't count.
-- The dashboard can read it like a column: clients?select=name,completed_visits
create or replace function public.completed_visits(c public.clients)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.bookings b
  join public.stylists s on s.id = b.stylist_id
  where b.client_id = c.id
    and b.status = 'confirmed'
    and b.booking_date + b.end_time <= now() at time zone s.timezone
$$;

-- Makes New clients Regulars once they've had enough appointments.
-- Returns how many changed.
create or replace function public.apply_auto_regulars(p_stylist_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.clients c
  set status = 'regular'
  from public.stylists s
  where s.id = p_stylist_id
    and c.stylist_id = s.id
    and s.auto_regular_after > 0
    and c.status = 'new'
    and c.auto_regular
    and public.completed_visits(c) >= s.auto_regular_after;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- For the stylist's dashboard: check their own clients now.
create or replace function public.refresh_my_regulars()
returns integer
language sql
volatile
security definer
set search_path = ''
as $$
  select public.apply_auto_regulars(auth.uid())
$$;

-- ============ WHO IS BOOKING ============

-- The visitor's phone number (as a phone_key), but only if they proved it
-- with a text message code. A password login doesn't count.
create or replace function public.booking_verified_phone()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.phone_key(u.phone)
  from auth.users u
  where u.id = auth.uid()
    and u.phone_confirmed_at is not null
    and exists (
      select 1
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as a(claim)
      where a.claim ->> 'method' in ('otp', 'sms', 'sms/signup')
    )
$$;

-- 'anonymous' (not verified), 'unknown' (verified, not on the client list),
-- or their client status: 'regular', 'new' or 'blocked'.
-- Matched by verified phone number or verified email. If either one belongs
-- to a blocked client, they're blocked.
create or replace function public.booking_viewer_status(p_stylist_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when v.email is null and v.phone is null then 'anonymous'
    else coalesce(
      (
        select c.status
        from public.clients c
        where c.stylist_id = p_stylist_id
          and (
            (v.phone is not null and public.phone_key(c.phone) = v.phone)
            or (v.email is not null and lower(c.email) = v.email)
          )
        order by case c.status when 'blocked' then 0 when 'regular' then 1 else 2 end
        limit 1
      ),
      'unknown'
    )
  end
  from (
    select public.booking_verified_email() as email, public.booking_verified_phone() as phone
  ) v
$$;

-- ============ BOOKINGS ============

-- Clients who confirm by text don't have to give an email.
alter table public.bookings alter column client_email drop not null;
-- The login that made the booking (phone or email code).
alter table public.bookings add column if not exists booked_by uuid;

-- Public: the stylist's name, services, cancellation policy, and who the
-- visitor is. Also brings automatic Regulars up to date first, so a client
-- who just finished their 3rd appointment sees the Regulars-only times.
drop function if exists public.get_booking_page(text);
create function public.get_booking_page(p_slug text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stylist public.stylists;
begin
  select * into v_stylist from public.stylists where slug = lower(p_slug);
  if not found then
    return null;
  end if;

  perform public.apply_auto_regulars(v_stylist.id);

  return jsonb_build_object(
    'business_name', v_stylist.business_name,
    'slug', v_stylist.slug,
    'timezone', v_stylist.timezone,
    'cancellation_policy', v_stylist.cancellation_policy,
    'viewer_status', public.booking_viewer_status(v_stylist.id),
    'viewer_email', public.booking_verified_email(),
    'viewer_phone', public.booking_verified_phone(),
    'services', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', sv.id,
            'name', sv.name,
            'price_cents', sv.price_cents,
            'duration_minutes', sv.duration_minutes,
            'deposit_cents', public.service_deposit_cents(v_stylist, sv)
          )
          order by sv.created_at
        )
        from public.services sv
        where sv.stylist_id = v_stylist.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- Public: book a time. The visitor must have confirmed their phone or email
-- with a code. Everything is checked again here, so the page can't be tricked.
-- p_phone: confirmed by text -> must be that number; confirmed by email -> any number.
-- p_email: only used (optional) when they confirmed by text.
drop function if exists public.create_booking(text, uuid, date, time, text, text);
drop function if exists public.create_booking(text, uuid, date, time, text, text, text);
create function public.create_booking(
  p_slug text,
  p_service_id uuid,
  p_date date,
  p_time time,
  p_name text,
  p_phone text,
  p_email text default null
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
  v_status := public.booking_viewer_status(v_stylist.id);

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
    and b.booking_date + b.start_time > now() at time zone v_stylist.timezone;
  if v_upcoming >= 3 then
    raise exception 'too_many_bookings';
  end if;

  -- Find them on the client list by the phone or email they proved
  -- (Regular first), or add them as New.
  select c.id into v_client_id
  from public.clients c
  where c.stylist_id = v_stylist.id
    and (
      (v_verified_phone is not null and public.phone_key(c.phone) = v_verified_phone)
      or (v_email is not null and lower(c.email) = v_email)
    )
  order by case c.status when 'regular' then 0 else 1 end
  limit 1;

  if v_client_id is null then
    insert into public.clients (stylist_id, name, phone, email, status)
    values (v_stylist.id, v_name, v_phone, v_client_email, 'new')
    returning id into v_client_id;
  end if;

  v_end := p_time + make_interval(mins => v_service.duration_minutes);
  v_deposit := public.service_deposit_cents(v_stylist, v_service);
  v_booking_status := case when v_deposit > 0 then 'pending_payment' else 'confirmed' end;

  insert into public.bookings (
    stylist_id, service_id, client_id, service_name, price_cents,
    booking_date, start_time, end_time, client_name, client_email, client_phone,
    status, deposit_cents, deposit_status, hold_expires_at, cancellation_policy, booked_by
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
    auth.uid()
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

-- ============ WHO CAN CALL WHAT ============

-- Internal helpers.
revoke execute on function public.booking_verified_phone() from public, anon, authenticated;
revoke execute on function public.booking_viewer_status(uuid) from public, anon, authenticated;
revoke execute on function public.apply_auto_regulars(uuid) from public, anon, authenticated;

-- Stylists (logged in) can read visit counts and refresh their Regulars.
revoke execute on function public.completed_visits(public.clients) from public, anon;
grant execute on function public.completed_visits(public.clients) to authenticated;
revoke execute on function public.refresh_my_regulars() from public, anon;
grant execute on function public.refresh_my_regulars() to authenticated;

-- The public booking page functions.
revoke execute on function public.get_booking_page(text) from public;
revoke execute on function public.create_booking(text, uuid, date, time, text, text, text) from public;
grant execute on function public.get_booking_page(text) to anon, authenticated;
grant execute on function public.create_booking(text, uuid, date, time, text, text, text) to anon, authenticated;

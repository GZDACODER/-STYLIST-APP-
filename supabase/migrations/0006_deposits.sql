-- Step 5: deposits with Stripe.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Running it again later is safe.

-- ============ STYLISTS: deposit settings + Stripe account ============
alter table public.stylists add column if not exists deposits_enabled boolean not null default false;
alter table public.stylists add column if not exists cancellation_policy text not null default '';
-- The stylist's own Stripe account (Stripe Connect), e.g. "acct_1ABC...".
alter table public.stylists add column if not exists stripe_account_id text;
-- True once Stripe says the account can take card payments.
alter table public.stylists add column if not exists stripe_charges_enabled boolean not null default false;

alter table public.stylists drop constraint if exists stylists_policy_length;
alter table public.stylists add constraint stylists_policy_length
  check (char_length(cancellation_policy) <= 2000);

-- Stylists can change their own name, link, time zone and deposit settings,
-- but not their Stripe columns. Only the app's server (with the secret key)
-- writes those, after checking with Stripe.
revoke update on public.stylists from anon, authenticated;
grant update (business_name, slug, timezone, deposits_enabled, cancellation_policy)
  on public.stylists to authenticated;

-- ============ SERVICES: deposit per service ============
-- deposit_type: 'none', 'fixed' (deposit_amount is cents, e.g. 2000 = $20)
-- or 'percent' (deposit_amount is 1 to 100, e.g. 25 = 25% of the price).
alter table public.services add column if not exists deposit_type text not null default 'none';
alter table public.services add column if not exists deposit_amount integer not null default 0;

alter table public.services drop constraint if exists services_deposit_type_check;
alter table public.services add constraint services_deposit_type_check
  check (deposit_type in ('none', 'fixed', 'percent'));
alter table public.services drop constraint if exists services_deposit_amount_check;
alter table public.services add constraint services_deposit_amount_check
  check (
    deposit_amount >= 0
    and (deposit_type <> 'percent' or deposit_amount between 1 and 100)
  );

-- ============ BOOKINGS: deposits ============
-- New status 'pending_payment': the client is paying on Stripe. The time is
-- held until hold_expires_at, then it's released ('expired') if unpaid.
alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status in ('confirmed', 'cancelled', 'pending_payment', 'expired'));

alter table public.bookings add column if not exists deposit_cents integer not null default 0;
-- 'none' (no deposit), 'unpaid', 'paid', 'refund_pending' or 'refunded'.
alter table public.bookings add column if not exists deposit_status text not null default 'none';
alter table public.bookings add column if not exists deposit_paid_at timestamptz;
alter table public.bookings add column if not exists hold_expires_at timestamptz;
alter table public.bookings add column if not exists stripe_checkout_session_id text;
alter table public.bookings add column if not exists stripe_payment_intent_id text;
-- The cancellation policy the client saw when they booked.
alter table public.bookings add column if not exists cancellation_policy text not null default '';

alter table public.bookings drop constraint if exists bookings_deposit_status_check;
alter table public.bookings add constraint bookings_deposit_status_check
  check (deposit_status in ('none', 'unpaid', 'paid', 'refund_pending', 'refunded'));

create index if not exists bookings_checkout_session_idx
  on public.bookings (stripe_checkout_session_id);

-- A time being paid for counts as taken, so two people can't pay for it.
alter table public.bookings drop constraint if exists bookings_no_double_booking;
alter table public.bookings add constraint bookings_no_double_booking exclude using gist (
  stylist_id with =,
  tsrange(booking_date + start_time, booking_date + end_time) with &&
) where (status in ('confirmed', 'pending_payment'));

-- ============ DEPOSIT RULES ============

-- The deposit for one service, in cents. 0 means no deposit: deposits are
-- off, Stripe isn't connected yet, or it would be under Stripe's 50¢ minimum.
create or replace function public.service_deposit_cents(s public.stylists, sv public.services)
returns integer
language sql
stable
set search_path = ''
as $$
  select case when d.cents >= 50 then d.cents else 0 end
  from (
    select case
      when not (s.deposits_enabled and s.stripe_charges_enabled and s.stripe_account_id is not null)
        then 0
      when sv.deposit_type = 'fixed' then least(sv.deposit_amount, sv.price_cents)
      when sv.deposit_type = 'percent' then round(sv.price_cents * sv.deposit_amount / 100.0)::integer
      else 0
    end as cents
  ) d
$$;

-- Paying for a time takes a while, so unpaid holds stop counting once they expire.
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
  with local_now as (
    select (now() at time zone s.timezone) as ts
    from public.stylists s
    where s.id = p_stylist_id
  ),
  candidates as (
    select o.opening_date, o.visibility, gs.slot_start
    from public.openings o
    cross join local_now n
    cross join lateral generate_series(
      o.opening_date + o.start_time,
      o.opening_date + o.end_time - make_interval(mins => p_duration),
      interval '15 minutes'
    ) as gs(slot_start)
    where o.stylist_id = p_stylist_id
      and p_viewer <> 'blocked'
      and (o.visibility = 'everyone' or p_viewer = 'regular')
      and o.opening_date between n.ts::date and n.ts::date + 90
      and gs.slot_start >= n.ts + interval '1 hour'
      and not exists (
        select 1 from public.blocked_dates b
        where b.stylist_id = p_stylist_id and b.blocked_on = o.opening_date
      )
  )
  select c.opening_date, c.slot_start::time, c.visibility
  from candidates c
  where not exists (
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

-- Public: the stylist's name, services (with deposits), cancellation policy,
-- and who the visitor is.
create or replace function public.get_booking_page(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'business_name', s.business_name,
    'slug', s.slug,
    'timezone', s.timezone,
    'cancellation_policy', s.cancellation_policy,
    'viewer_status', public.booking_viewer_status(s.id),
    'viewer_email', public.booking_verified_email(),
    'services', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', sv.id,
            'name', sv.name,
            'price_cents', sv.price_cents,
            'duration_minutes', sv.duration_minutes,
            'deposit_cents', public.service_deposit_cents(s, sv)
          )
          order by sv.created_at
        )
        from public.services sv
        where sv.stylist_id = s.id
      ),
      '[]'::jsonb
    )
  )
  from public.stylists s
  where s.slug = lower(p_slug)
$$;

-- Public: book a time. The visitor must have verified their email.
-- Everything is checked again here, so the page can't be tricked.
-- Services with a deposit start as 'pending_payment'; the app then sends the
-- client to Stripe, and the booking is only confirmed once Stripe says it's paid.
create or replace function public.create_booking(
  p_slug text,
  p_service_id uuid,
  p_date date,
  p_time time,
  p_name text,
  p_phone text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := public.booking_verified_email();
  v_name text := trim(coalesce(p_name, ''));
  v_phone text := trim(coalesce(p_phone, ''));
  v_phone_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
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
  if v_email is null then
    raise exception 'not_verified';
  end if;
  if char_length(v_name) not between 1 and 100 then
    raise exception 'invalid_name';
  end if;
  if char_length(v_phone_digits) < 7 or char_length(v_phone) > 30 then
    raise exception 'invalid_phone';
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
    and (hold_expires_at <= now() or lower(client_email) = v_email);

  v_status := public.booking_viewer_status(v_stylist.id);

  -- A blocked client's phone number also blocks. (A phone number can only
  -- ever stop a booking; it never makes someone a regular.)
  if v_status = 'blocked' or exists (
    select 1 from public.clients c
    where c.stylist_id = v_stylist.id
      and c.status = 'blocked'
      and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_phone_digits
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
    and lower(b.client_email) = v_email
    and b.status = 'confirmed'
    and b.booking_date + b.start_time > now() at time zone v_stylist.timezone;
  if v_upcoming >= 3 then
    raise exception 'too_many_bookings';
  end if;

  -- Find them on the client list by verified email, or add them as New.
  select c.id into v_client_id
  from public.clients c
  where c.stylist_id = v_stylist.id and lower(c.email) = v_email
  order by case c.status when 'regular' then 0 else 1 end
  limit 1;

  if v_client_id is null then
    insert into public.clients (stylist_id, name, phone, email, status)
    values (v_stylist.id, v_name, v_phone, v_email, 'new')
    returning id into v_client_id;
  end if;

  v_end := p_time + make_interval(mins => v_service.duration_minutes);
  v_deposit := public.service_deposit_cents(v_stylist, v_service);
  v_booking_status := case when v_deposit > 0 then 'pending_payment' else 'confirmed' end;

  insert into public.bookings (
    stylist_id, service_id, client_id, service_name, price_cents,
    booking_date, start_time, end_time, client_name, client_email, client_phone,
    status, deposit_cents, deposit_status, hold_expires_at, cancellation_policy
  )
  values (
    v_stylist.id, v_service.id, v_client_id, v_service.name, v_service.price_cents,
    p_date, p_time, v_end, v_name, v_email, v_phone,
    v_booking_status,
    v_deposit,
    case when v_deposit > 0 then 'unpaid' else 'none' end,
    -- Stripe's payment page is open for 31 minutes; a few spare minutes
    -- let a payment that finishes right at the end still go through.
    case when v_deposit > 0 then now() + interval '35 minutes' end,
    v_stylist.cancellation_policy
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

-- ============ FOR THE APP'S SERVER ONLY ============
-- These are called after checking with Stripe, using the secret key.

-- Stripe says the deposit is paid: confirm the booking.
-- Returns 'confirmed', 'already_confirmed', 'refund' (the time was given to
-- someone else meanwhile, so the deposit must be refunded), 'already_refunded'
-- or 'not_found'.
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

-- The refund went through on Stripe.
create or replace function public.mark_deposit_refunded(p_booking_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.bookings
  set deposit_status = 'refunded'
  where id = p_booking_id and deposit_status = 'refund_pending'
$$;

-- The client didn't pay (they went back, or Stripe's page timed out):
-- release the time straight away.
create or replace function public.release_deposit_hold(p_booking_id uuid, p_session_id text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.bookings
  set status = 'expired'
  where id = p_booking_id
    and status = 'pending_payment'
    and stripe_checkout_session_id is not distinct from p_session_id
$$;

-- Internal helpers.
revoke execute on function public.service_deposit_cents(public.stylists, public.services) from public, anon, authenticated;
revoke execute on function public.booking_open_slots(uuid, integer, text) from public, anon, authenticated;

-- Only the app's server may call these.
revoke execute on function public.confirm_deposit_payment(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.mark_deposit_refunded(uuid) from public, anon, authenticated;
revoke execute on function public.release_deposit_hold(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_deposit_payment(uuid, text, text) to service_role;
grant execute on function public.mark_deposit_refunded(uuid) to service_role;
grant execute on function public.release_deposit_hold(uuid, text) to service_role;

-- The public booking page functions (same as step 4).
grant execute on function public.get_booking_page(text) to anon, authenticated;
grant execute on function public.create_booking(text, uuid, date, time, text, text) to anon, authenticated;

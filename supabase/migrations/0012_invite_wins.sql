-- Step 8 fix 2: invite links win over a shared email.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0011_match_by_phone.sql first. Running this again later is safe.
--
-- Before: someone who confirmed by email and booked with an invite link was
-- still put on the card of a client with that email if that client had no
-- phone number on file (and was shown as that Regular). Now an invite made
-- out to the phone number they book with decides: they're a new, Invited
-- client, the invite is used, and the booking goes on their own card.
-- (If that phone number already belongs to a Regular, they're that Regular.)

-- Public: book a time. Same as 0011, with the invite rule above.
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

revoke execute on function public.create_booking(text, uuid, date, time, text, text, text, text) from public;
grant execute on function public.create_booking(text, uuid, date, time, text, text, text, text) to anon, authenticated;

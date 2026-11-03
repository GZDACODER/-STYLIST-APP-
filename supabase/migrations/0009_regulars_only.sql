-- Step 8: "Regulars only" mode, freed Regulars times that stay Regulars-only,
-- and private invite links for new clients.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Running it again later is safe.
--
-- How it works:
--  * Regulars only (Settings): new clients see no times and can't join the
--    waitlist. Only verified Regulars can book, plus anyone with an invite link.
--  * A booking made in a "Regulars only" time (or while Regulars only is on)
--    is a Regulars booking. If it's cancelled, that time is kept for Regulars
--    (a "Regulars hold"), so only Regulars see it and only waitlisted Regulars
--    hear about it. The stylist can open it to everyone on the Openings tab.
--  * Invite links: a one-time link for one new client. It lets them see and
--    book your "Everyone" times, even in Regulars only mode. Once they've
--    booked, they show as Invited on the Clients tab.

-- ============ STYLISTS: Regulars only ============
alter table public.stylists add column if not exists regulars_only boolean not null default false;
grant update (regulars_only) on public.stylists to authenticated;

-- ============ INVITE LINKS ============
create table if not exists public.client_invites (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  -- The secret in the link.
  token text not null unique
    default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  -- Who it's for. If a phone number is given, only that number can use it.
  name text not null check (char_length(name) between 1 and 100),
  phone text check (phone is null or char_length(phone) <= 30),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  cancelled_at timestamptz
);

create index if not exists client_invites_stylist_idx on public.client_invites (stylist_id, created_at);

alter table public.client_invites enable row level security;

drop policy if exists "Stylists can view own invites" on public.client_invites;
create policy "Stylists can view own invites"
  on public.client_invites for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can add own invites" on public.client_invites;
create policy "Stylists can add own invites"
  on public.client_invites for insert
  to authenticated
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can update own invites" on public.client_invites;
create policy "Stylists can update own invites"
  on public.client_invites for update
  to authenticated
  using ((select auth.uid()) = stylist_id)
  with check ((select auth.uid()) = stylist_id);

-- Which invite a booking used, and clients who came from an invite.
alter table public.bookings add column if not exists invite_id uuid
  references public.client_invites (id) on delete set null;
alter table public.clients add column if not exists invited_at timestamptz;
alter table public.clients add column if not exists invite_id uuid
  references public.client_invites (id) on delete set null;

-- 'open', 'used' (it booked an appointment), 'expired' or 'cancelled'.
-- The dashboard can read it like a column: client_invites?select=name,invite_state
create or replace function public.invite_state(i public.client_invites)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when exists (
      select 1 from public.bookings b
      where b.invite_id = i.id and b.status in ('confirmed', 'cancelled')
    ) then 'used'
    when i.cancelled_at is not null then 'cancelled'
    when i.expires_at <= now() then 'expired'
    else 'open'
  end
$$;

-- The invite, if this link can be used right now (otherwise an empty row).
-- Not while someone else is in the middle of paying a deposit with it.
create or replace function public.booking_find_invite(p_stylist_id uuid, p_token text)
returns public.client_invites
language sql
stable
security definer
set search_path = ''
as $$
  select i.*
  from public.client_invites i
  where i.stylist_id = p_stylist_id
    and i.token = p_token
    and public.invite_state(i) = 'open'
    and not exists (
      select 1 from public.bookings b
      where b.invite_id = i.id
        and b.status = 'pending_payment'
        and b.hold_expires_at > now()
        and b.booked_by is distinct from auth.uid()
    )
$$;

-- What the visitor can see and book: their client status ('regular', 'new',
-- 'unknown', 'anonymous' or 'blocked'), or 'invited' when they're not a
-- Regular and came with a working invite link.
create or replace function public.booking_access(p_stylist_id uuid, p_invite text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when v.status in ('regular', 'blocked') then v.status
    when p_invite is not null
      and (public.booking_find_invite(p_stylist_id, p_invite)).id is not null then 'invited'
    else v.status
  end
  from (select public.booking_viewer_status(p_stylist_id) as status) v
$$;

-- ============ REGULARS HOLDS ============
-- Freed times from cancelled Regulars bookings. They stay Regulars-only until
-- they're booked again, or the stylist opens them to everyone.
create table if not exists public.regulars_holds (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  hold_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now()
);

create index if not exists regulars_holds_stylist_idx on public.regulars_holds (stylist_id, hold_date);

alter table public.regulars_holds enable row level security;

drop policy if exists "Stylists can view own holds" on public.regulars_holds;
create policy "Stylists can view own holds"
  on public.regulars_holds for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can delete own holds" on public.regulars_holds;
create policy "Stylists can delete own holds"
  on public.regulars_holds for delete
  to authenticated
  using ((select auth.uid()) = stylist_id);

-- A booking is a Regulars booking if it's in a "Regulars only" opening, in a
-- Regulars hold, or made while Regulars only mode is on.
alter table public.bookings add column if not exists regulars_only boolean not null default false;

create or replace function public.bookings_mark_regulars_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.regulars_only := coalesce(
    (select s.regulars_only from public.stylists s where s.id = new.stylist_id), false
  )
  or exists (
    select 1 from public.openings o
    where o.stylist_id = new.stylist_id
      and o.opening_date = new.booking_date
      and o.visibility = 'regulars'
      and o.start_time < new.end_time
      and o.end_time > new.start_time
  )
  or exists (
    select 1 from public.regulars_holds h
    where h.stylist_id = new.stylist_id
      and h.hold_date = new.booking_date
      and h.start_time < new.end_time
      and h.end_time > new.start_time
  );

  -- The booking now carries the hold; it comes back if it's cancelled.
  if new.status in ('confirmed', 'pending_payment') then
    delete from public.regulars_holds h
    where h.stylist_id = new.stylist_id
      and h.hold_date = new.booking_date
      and h.start_time < new.end_time
      and h.end_time > new.start_time;
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_mark_regulars_only on public.bookings;
create trigger bookings_mark_regulars_only
  before insert on public.bookings
  for each row execute function public.bookings_mark_regulars_only();

-- A Regulars booking was cancelled (or its deposit wasn't paid): keep the time for Regulars.
create or replace function public.bookings_keep_for_regulars()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.regulars_holds (stylist_id, hold_date, start_time, end_time)
  values (new.stylist_id, new.booking_date, new.start_time, new.end_time);
  return null;
end;
$$;

drop trigger if exists bookings_keep_for_regulars on public.bookings;
create trigger bookings_keep_for_regulars
  after update of status on public.bookings
  for each row
  when (
    new.regulars_only
    and old.status in ('confirmed', 'pending_payment')
    and new.status in ('cancelled', 'expired')
  )
  execute function public.bookings_keep_for_regulars();

-- ============ OPEN TIMES (same as step 5, plus the new rules) ============
-- A time counts as "Regulars only" if its opening is, if it's in a Regulars
-- hold, or if it's an unpaid Regulars hold that just ran out. In Regulars only
-- mode, only Regulars and invited clients see anything; invited clients see
-- the "Everyone" times.
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
  with stylist as (
    select (now() at time zone s.timezone) as ts, s.regulars_only
    from public.stylists s
    where s.id = p_stylist_id
  ),
  candidates as (
    select
      o.opening_date,
      gs.slot_start,
      st.regulars_only as mode_on,
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
      interval '15 minutes'
    ) as gs(slot_start)
    where o.stylist_id = p_stylist_id
      and p_viewer <> 'blocked'
      and o.opening_date between st.ts::date and st.ts::date + 90
      and gs.slot_start >= st.ts + interval '1 hour'
      and not exists (
        select 1 from public.blocked_dates b
        where b.stylist_id = p_stylist_id and b.blocked_on = o.opening_date
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
        and bk.booking_date + bk.start_time < c.slot_start + make_interval(mins => p_duration)
        and bk.booking_date + bk.end_time > c.slot_start
    )
$$;

-- The waitlist's record of free time (step 7) counts Regulars holds as
-- "Regulars only" too, so opening a hold to everyone is news for everyone else.
create or replace function public.waitlist_sync_free_time(p_stylist_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  with local_now as (
    select (now() at time zone s.timezone) as ts
    from public.stylists s
    where s.id = p_stylist_id
  ),
  free as (
    select
      gs.block_start,
      case
        when o.visibility = 'regulars' or exists (
          select 1 from public.regulars_holds h
          where h.stylist_id = p_stylist_id
            and h.hold_date = o.opening_date
            and h.hold_date + h.start_time < gs.block_start + interval '15 minutes'
            and h.hold_date + h.end_time > gs.block_start
        ) then 'regulars'
        else 'everyone'
      end as visibility
    from public.openings o
    cross join local_now n
    cross join lateral generate_series(
      o.opening_date + o.start_time,
      o.opening_date + o.end_time - interval '15 minutes',
      interval '15 minutes'
    ) as gs(block_start)
    where o.stylist_id = p_stylist_id
      and o.opening_date between n.ts::date and n.ts::date + 90
      and not exists (
        select 1 from public.blocked_dates b
        where b.stylist_id = p_stylist_id and b.blocked_on = o.opening_date
      )
      and not exists (
        select 1 from public.bookings bk
        where bk.stylist_id = p_stylist_id
          and (
            bk.status = 'confirmed'
            or (bk.status = 'pending_payment' and bk.hold_expires_at > now())
          )
          and bk.booking_date + bk.start_time < gs.block_start + interval '15 minutes'
          and bk.booking_date + bk.end_time > gs.block_start
      )
  ),
  gone as (
    delete from public.waitlist_free_time w
    where w.stylist_id = p_stylist_id
      and not exists (select 1 from free f where f.block_start = w.starts_at)
  )
  insert into public.waitlist_free_time as w (stylist_id, starts_at, visibility, opened_at, public_at)
  select p_stylist_id, f.block_start, f.visibility, now(),
    case when f.visibility = 'everyone' then now() end
  from free f
  on conflict (stylist_id, starts_at) do update
  set visibility = excluded.visibility,
      -- Switching "Regulars only" to "Everyone" counts as new for everyone else.
      public_at = case when excluded.visibility = 'everyone' then coalesce(w.public_at, now()) end
  where w.visibility is distinct from excluded.visibility
$$;

-- ============ WAITLIST: Regulars only ============
-- In Regulars only mode, only Regulars can join the waitlist.
create or replace function public.waitlist_check_regulars_only()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.stylists s where s.id = new.stylist_id and s.regulars_only)
    and public.client_status(new) <> 'regular' then
    raise exception 'regulars_only';
  end if;
  return new;
end;
$$;

drop trigger if exists waitlist_check_regulars_only on public.waitlist_entries;
create trigger waitlist_check_regulars_only
  before insert on public.waitlist_entries
  for each row execute function public.waitlist_check_regulars_only();

-- ============ BOOKING PAGE (now with invite links) ============

-- Public: the stylist's page. Same as step 7, plus Regulars only mode and
-- the invite link the visitor came with (if any).
drop function if exists public.get_booking_page(text);
drop function if exists public.get_booking_page(text, text);
create function public.get_booking_page(p_slug text, p_invite text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stylist public.stylists;
  v_invite public.client_invites;
begin
  select * into v_stylist from public.stylists where slug = lower(p_slug);
  if not found then
    return null;
  end if;

  perform public.apply_auto_regulars(v_stylist.id);

  if p_invite is not null then
    select * into v_invite from public.client_invites
    where stylist_id = v_stylist.id and token = p_invite;
  end if;

  return jsonb_build_object(
    'business_name', v_stylist.business_name,
    'slug', v_stylist.slug,
    'timezone', v_stylist.timezone,
    'cancellation_policy', v_stylist.cancellation_policy,
    'waitlist_enabled', v_stylist.waitlist_enabled,
    'regulars_only', v_stylist.regulars_only,
    -- What they can do: 'regular', 'invited', 'new', 'unknown', 'anonymous' or 'blocked'.
    'access', public.booking_access(v_stylist.id, p_invite),
    -- The invite link they came with: 'open', 'used', 'expired', 'cancelled',
    -- 'busy' (someone is paying a deposit with it) or 'invalid'.
    'invite', case
      when p_invite is null then null
      when v_invite.id is null then jsonb_build_object('state', 'invalid')
      when (public.booking_find_invite(v_stylist.id, p_invite)).id is not null
        then jsonb_build_object('state', 'open', 'name', v_invite.name)
      when public.invite_state(v_invite) = 'open'
        then jsonb_build_object('state', 'busy', 'name', v_invite.name)
      else jsonb_build_object('state', public.invite_state(v_invite), 'name', v_invite.name)
    end,
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

-- Public: open times for one service, as this visitor is allowed to see them.
drop function if exists public.get_open_slots(text, uuid);
drop function if exists public.get_open_slots(text, uuid, text);
create function public.get_open_slots(p_slug text, p_service_id uuid, p_invite text default null)
returns table (slot_date date, slot_time time, visibility text)
language sql
stable
security definer
set search_path = ''
as $$
  select o.slot_date, o.slot_time, o.visibility
  from public.stylists s
  join public.services sv on sv.stylist_id = s.id and sv.id = p_service_id
  cross join lateral public.booking_open_slots(
    s.id, sv.duration_minutes, public.booking_access(s.id, p_invite)
  ) o
  where s.slug = lower(p_slug)
  order by 1, 2
$$;

-- Public: book a time. Same as step 6, plus invite links: a client who came
-- with one can book (even in Regulars only mode) and shows as Invited.
drop function if exists public.create_booking(text, uuid, date, time, text, text, text);
drop function if exists public.create_booking(text, uuid, date, time, text, text, text, text);
create function public.create_booking(
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

-- ============ WHO CAN CALL WHAT ============

-- Internal helpers.
revoke execute on function public.booking_find_invite(uuid, text) from public, anon, authenticated;
revoke execute on function public.booking_access(uuid, text) from public, anon, authenticated;
revoke execute on function public.bookings_mark_regulars_only() from public, anon, authenticated;
revoke execute on function public.bookings_keep_for_regulars() from public, anon, authenticated;
revoke execute on function public.waitlist_check_regulars_only() from public, anon, authenticated;
revoke execute on function public.booking_open_slots(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.waitlist_sync_free_time(uuid) from public, anon, authenticated;

-- Stylists (logged in) can read an invite's state.
revoke execute on function public.invite_state(public.client_invites) from public, anon;
grant execute on function public.invite_state(public.client_invites) to authenticated;

-- The public booking page functions.
revoke execute on function public.get_booking_page(text, text) from public;
revoke execute on function public.get_open_slots(text, uuid, text) from public;
revoke execute on function public.create_booking(text, uuid, date, time, text, text, text, text) from public;
grant execute on function public.get_booking_page(text, text) to anon, authenticated;
grant execute on function public.get_open_slots(text, uuid, text) to anon, authenticated;
grant execute on function public.create_booking(text, uuid, date, time, text, text, text, text) to anon, authenticated;

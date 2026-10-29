-- Step 7: the smart waitlist, and clients cancelling their own bookings.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Running it again later is safe.
--
-- How it works:
--  * A client who can't find a time joins the waitlist for a service, with the
--    days and times of day they'd like.
--  * Every minute (and straight away when a booking is cancelled or new times
--    are posted), the app asks waitlist_process() what's changed. It notices
--    times that have just opened up and lists who to tell.
--  * Regulars are told first. Everyone else is told after the stylist's
--    "regulars first" minutes, if the time is still free. If no regular wants
--    that time, everyone is told straight away.
--  * Each time comes with a secret "Claim this time" link. The first person to
--    claim it gets it, and the normal deposit step still applies.

-- ============ STYLISTS: waitlist settings ============
alter table public.stylists add column if not exists waitlist_enabled boolean not null default true;
-- How long regulars get to claim a newly opened time before everyone else
-- hears about it. 0 = tell everyone at once.
alter table public.stylists add column if not exists waitlist_regulars_minutes integer not null default 30;

alter table public.stylists drop constraint if exists stylists_waitlist_minutes_check;
alter table public.stylists add constraint stylists_waitlist_minutes_check
  check (waitlist_regulars_minutes between 0 and 1440);

grant update (waitlist_enabled, waitlist_regulars_minutes) on public.stylists to authenticated;

-- ============ HELPERS ============

-- A long random code for secret links ("Claim this time", "Leave the waitlist").
create or replace function public.waitlist_token()
returns text
language sql
volatile
set search_path = ''
as $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

-- 'morning' (before noon), 'afternoon' (noon to 5 PM) or 'evening' (5 PM on).
create or replace function public.waitlist_part_of_day(p_time time)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_time < time '12:00' then 'morning'
    when p_time < time '17:00' then 'afternoon'
    else 'evening'
  end
$$;

-- Does a time fit what the client asked for? An empty list means "any".
-- p_days: 0 = Sunday ... 6 = Saturday.
create or replace function public.waitlist_wants(p_days smallint[], p_times text[], p_date date, p_time time)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select (cardinality(p_days) = 0 or extract(dow from p_date)::smallint = any (p_days))
     and (cardinality(p_times) = 0 or public.waitlist_part_of_day(p_time) = any (p_times))
$$;

-- ============ WAITLIST ENTRIES ============
-- One row per client per service they're waiting for.
-- status: 'waiting', 'booked' (they got a time), 'removed' (they left, or the
-- stylist took them off) or 'expired' (after 90 days).
create table if not exists public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  -- The login (phone or email code) that joined. Their bookings use it too.
  user_id uuid not null,
  name text not null check (char_length(name) between 1 and 100),
  phone text not null check (char_length(phone) <= 30),
  -- Where to send "a time opened up" emails.
  email text check (email is null or char_length(email) <= 254),
  -- What they proved with a code. Only these decide if they're a Regular.
  verified_phone text,
  verified_email text,
  days smallint[] not null default '{}' check (days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  times text[] not null default '{}' check (times <@ '{morning,afternoon,evening}'::text[]),
  -- They agreed to get texts too (only offered once texts are switched on).
  text_ok boolean not null default false,
  status text not null default 'waiting' check (status in ('waiting', 'booked', 'removed', 'expired')),
  -- For the "see your times / leave the waitlist" link in every message.
  manage_token text not null unique default public.waitlist_token(),
  -- Only times that open up after this count as new for them. Moves forward
  -- when they change what they're waiting for.
  watch_from timestamptz not null default now(),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists waitlist_entries_stylist_idx on public.waitlist_entries (stylist_id, status);

alter table public.waitlist_entries enable row level security;

-- Stylists can see their waitlist and take people off it. Clients never read
-- this table directly; they go through the functions further down.
drop policy if exists "Stylists can view own waitlist" on public.waitlist_entries;
create policy "Stylists can view own waitlist"
  on public.waitlist_entries for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can update own waitlist" on public.waitlist_entries;
create policy "Stylists can update own waitlist"
  on public.waitlist_entries for update
  to authenticated
  using ((select auth.uid()) = stylist_id)
  with check ((select auth.uid()) = stylist_id);

-- The waitlisted client's status on the stylist's client list: 'regular',
-- 'new', 'blocked' or 'unknown' (not on the list). Matched only by the phone
-- number or email they proved with a code.
-- The dashboard can read it like a column: waitlist_entries?select=name,client_status
create or replace function public.client_status(e public.waitlist_entries)
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (
      select c.status
      from public.clients c
      where c.stylist_id = e.stylist_id
        and (
          (e.verified_phone is not null and public.phone_key(c.phone) = e.verified_phone)
          or (e.verified_email is not null and lower(c.email) = e.verified_email)
        )
      order by case c.status when 'blocked' then 0 when 'regular' then 1 else 2 end
      limit 1
    ),
    'unknown'
  )
$$;

-- ============ FREE TIME ============
-- Every free 15-minute block of the stylist's openings, and when it became
-- free. This is how the app tells "just opened up" from "has been open for
-- weeks". Only the functions below use it.
create table if not exists public.waitlist_free_time (
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  starts_at timestamp not null,
  visibility text not null,
  -- When it became free (for regulars, who see every opening).
  opened_at timestamptz not null default now(),
  -- When everyone could see it (null while it's "Regulars only").
  public_at timestamptz,
  primary key (stylist_id, starts_at)
);

alter table public.waitlist_free_time enable row level security;

-- ============ OFFERS ============
-- "This time opened up" for one waitlisted client. claim_token is the secret
-- in their "Claim this time" link.
create table if not exists public.waitlist_offers (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.waitlist_entries (id) on delete cascade,
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  slot_date date not null,
  slot_time time not null,
  end_time time not null,
  -- 'regulars' (told first) or 'everyone'.
  wave text not null check (wave in ('regulars', 'everyone')),
  -- When this time opened up.
  opened_at timestamptz not null,
  -- When to tell them (later for non-regulars, so regulars get first pick).
  available_at timestamptz not null default now(),
  notified_at timestamptz,
  notify_attempts integer not null default 0,
  claim_token text not null unique default public.waitlist_token(),
  booking_id uuid references public.bookings (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (entry_id, slot_date, slot_time)
);

create index if not exists waitlist_offers_stylist_idx on public.waitlist_offers (stylist_id, slot_date);
create index if not exists waitlist_offers_booking_idx on public.waitlist_offers (booking_id);

alter table public.waitlist_offers enable row level security;

drop policy if exists "Stylists can view own waitlist offers" on public.waitlist_offers;
create policy "Stylists can view own waitlist offers"
  on public.waitlist_offers for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

-- ============ FINDING NEWLY OPENED TIMES ============

-- Brings waitlist_free_time up to date with the stylist's openings, blocked
-- dates and bookings (the same rules as the booking page).
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
    select gs.block_start, o.visibility
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

-- When a time is booked, note straight away that it's taken. Otherwise a time
-- booked and cancelled between two checks wouldn't look newly opened.
-- (Only bothers when someone is on this stylist's waitlist.)
create or replace function public.waitlist_note_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.waitlist_entries e
    where e.stylist_id = new.stylist_id and e.status = 'waiting'
  ) then
    perform pg_advisory_xact_lock(hashtext('waitlist:' || new.stylist_id::text));
    perform public.waitlist_sync_free_time(new.stylist_id);
  end if;
  return null;
end;
$$;

drop trigger if exists bookings_waitlist_note on public.bookings;
create trigger bookings_waitlist_note
  after insert on public.bookings
  for each row
  when (new.status in ('confirmed', 'pending_payment'))
  execute function public.waitlist_note_booking();

-- Looks for times that opened up for each waitlisted client of one stylist,
-- and lines up who to tell and when.
create or replace function public.waitlist_scan(p_stylist_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stylist public.stylists;
  v_entry record;
  v_open timestamp[];
  v_delay interval;
begin
  select * into v_stylist from public.stylists where id = p_stylist_id;
  if not found then
    return;
  end if;

  -- One scan at a time per stylist, so nobody is told twice.
  perform pg_advisory_xact_lock(hashtext('waitlist:' || p_stylist_id::text));

  -- Waitlist spots end after 90 days, or once the client has booked the service.
  update public.waitlist_entries e
  set status = 'expired', ended_at = now()
  where e.stylist_id = p_stylist_id
    and e.status = 'waiting'
    and e.created_at < now() - interval '90 days';

  update public.waitlist_entries e
  set status = 'booked', ended_at = now()
  where e.stylist_id = p_stylist_id
    and e.status = 'waiting'
    and exists (
      select 1 from public.bookings b
      where b.stylist_id = e.stylist_id
        and b.service_id = e.service_id
        and b.booked_by = e.user_id
        and b.status = 'confirmed'
        and b.created_at >= e.created_at
    );

  -- Times that have passed.
  delete from public.waitlist_offers o
  where o.stylist_id = p_stylist_id
    and o.slot_date < (now() at time zone v_stylist.timezone)::date;

  if not v_stylist.waitlist_enabled then
    return;
  end if;

  perform public.waitlist_sync_free_time(p_stylist_id);
  v_delay := make_interval(mins => v_stylist.waitlist_regulars_minutes);

  -- Regulars first, so everyone else can wait behind them.
  for v_entry in
    select e.id, e.days, e.times, e.watch_from, sv.duration_minutes, public.client_status(e) as status
    from public.waitlist_entries e
    join public.services sv on sv.id = e.service_id
    where e.stylist_id = p_stylist_id and e.status = 'waiting'
    order by (public.client_status(e) = 'regular') desc, e.created_at
  loop
    if v_entry.status = 'blocked' then
      delete from public.waitlist_offers o
      where o.entry_id = v_entry.id and o.notified_at is null;
      continue;
    end if;

    -- Every open time this client could book and would like.
    select coalesce(array_agg(s.slot_date + s.slot_time), '{}')
    into v_open
    from public.booking_open_slots(p_stylist_id, v_entry.duration_minutes, v_entry.status) s
    where public.waitlist_wants(v_entry.days, v_entry.times, s.slot_date, s.slot_time);

    -- Someone took it before this client was told: don't tell them.
    delete from public.waitlist_offers o
    where o.entry_id = v_entry.id
      and o.notified_at is null
      and o.booking_id is null
      and not ((o.slot_date + o.slot_time) = any (v_open));

    insert into public.waitlist_offers as o (
      entry_id, stylist_id, slot_date, slot_time, end_time, wave, opened_at, available_at
    )
    select
      v_entry.id,
      p_stylist_id,
      n.slot_start::date,
      n.slot_start::time,
      (n.slot_start + make_interval(mins => v_entry.duration_minutes))::time,
      case when v_entry.status = 'regular' then 'regulars' else 'everyone' end,
      n.opened_at,
      case
        when v_entry.status = 'regular' then now()
        -- A regular was offered an overlapping time that opened at the same
        -- moment: give them their head start.
        when exists (
          select 1 from public.waitlist_offers r
          where r.stylist_id = p_stylist_id
            and r.wave = 'regulars'
            and r.created_at >= n.opened_at
            and r.slot_date = n.slot_start::date
            and r.slot_time < (n.slot_start + make_interval(mins => v_entry.duration_minutes))::time
            and r.end_time > n.slot_start::time
        ) then greatest(now(), n.opened_at + v_delay)
        else now()
      end
    from (
      select t.slot_start,
        (
          -- The time opened up when its last 15-minute block became free.
          select max(case when v_entry.status = 'regular' then w.opened_at else w.public_at end)
          from public.waitlist_free_time w
          where w.stylist_id = p_stylist_id
            and w.starts_at >= t.slot_start
            and w.starts_at < t.slot_start + make_interval(mins => v_entry.duration_minutes)
        ) as opened_at
      from unnest(v_open) as t(slot_start)
    ) n
    where n.opened_at > v_entry.watch_from
      and not exists (
        select 1 from public.waitlist_offers x
        where x.entry_id = v_entry.id
          and x.slot_date = n.slot_start::date
          and x.slot_time = n.slot_start::time
          and x.opened_at >= n.opened_at
      )
    -- It was offered before, was taken, and has opened up again.
    on conflict (entry_id, slot_date, slot_time) do update
    set wave = excluded.wave,
        opened_at = excluded.opened_at,
        available_at = excluded.available_at,
        end_time = excluded.end_time,
        notified_at = null,
        notify_attempts = 0,
        claim_token = public.waitlist_token(),
        booking_id = null,
        claimed_at = null,
        created_at = now();
  end loop;
end;
$$;

-- For the app's server: scan (one stylist, or every stylist with someone
-- waiting when p_stylist_id is null), then hand back who to tell now.
-- Those offers are marked as sent; if sending fails, the app calls
-- waitlist_unmark() so they're tried again (up to 3 times).
create or replace function public.waitlist_process(p_stylist_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stylist_id uuid;
  v_stylists uuid[];
  v_result jsonb;
begin
  select coalesce(array_agg(distinct e.stylist_id), '{}')
  into v_stylists
  from public.waitlist_entries e
  where e.status = 'waiting'
    and (p_stylist_id is null or e.stylist_id = p_stylist_id);

  foreach v_stylist_id in array v_stylists loop
    perform public.waitlist_scan(v_stylist_id);
  end loop;

  with due as (
    select o.id
    from public.waitlist_offers o
    join public.waitlist_entries e on e.id = o.entry_id
    join public.stylists s on s.id = o.stylist_id
    where o.stylist_id = any (v_stylists)
      and s.waitlist_enabled
      and e.status = 'waiting'
      and o.notified_at is null
      and o.booking_id is null
      and o.available_at <= now()
      and o.notify_attempts < 3
    for update of o skip locked
  ),
  sent as (
    update public.waitlist_offers o
    set notified_at = now()
    from due
    where o.id = due.id
    returning o.id, o.entry_id, o.claim_token, o.slot_date, o.slot_time, o.end_time, o.wave
  ),
  per_entry as (
    select
      e.id as entry_id,
      jsonb_build_object(
        'entry_id', e.id,
        'name', e.name,
        'email', e.email,
        'phone', e.phone,
        'text_ok', e.text_ok,
        'manage_token', e.manage_token,
        'regular', bool_or(sent.wave = 'regulars'),
        'stylist_id', s.id,
        'business_name', s.business_name,
        'slug', s.slug,
        'timezone', s.timezone,
        'service_name', sv.name,
        'deposit_cents', public.service_deposit_cents(s, sv),
        'offers', jsonb_agg(
          jsonb_build_object(
            'id', sent.id,
            'claim_token', sent.claim_token,
            'slot_date', sent.slot_date,
            'slot_time', sent.slot_time,
            'end_time', sent.end_time
          )
          order by sent.slot_date, sent.slot_time
        )
      ) as info
    from sent
    join public.waitlist_entries e on e.id = sent.entry_id
    join public.stylists s on s.id = e.stylist_id
    join public.services sv on sv.id = e.service_id
    group by e.id, s.id, sv.id
  )
  select coalesce(jsonb_agg(info), '[]'::jsonb) into v_result from per_entry;

  return v_result;
end;
$$;

-- Sending failed: try these offers again next time.
create or replace function public.waitlist_unmark(p_offer_ids uuid[])
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.waitlist_offers
  set notified_at = null, notify_attempts = notify_attempts + 1
  where id = any (p_offer_ids) and booking_id is null
$$;

-- ============ FOR THE PUBLIC BOOKING PAGE ============

-- Same as step 6, plus whether the waitlist is on.
create or replace function public.get_booking_page(p_slug text)
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
    'waitlist_enabled', v_stylist.waitlist_enabled,
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

-- Public: join the waitlist (or change what you're waiting for). The visitor
-- must have confirmed their phone or email with a code, like booking.
-- Returns how many open times already match, so the page can point them out.
create or replace function public.join_waitlist(
  p_slug text,
  p_service_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_days smallint[],
  p_times text[],
  p_text_ok boolean default false
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
  v_contact_email text;
  v_days smallint[] := coalesce(p_days, '{}');
  v_times text[] := coalesce(p_times, '{}');
  v_stylist public.stylists;
  v_service public.services;
  v_status text;
  v_entry_id uuid;
  v_updated boolean;
  v_waiting integer;
  v_matching integer;
begin
  if v_email is null and v_verified_phone is null then
    raise exception 'not_verified';
  end if;
  if char_length(v_name) not between 1 and 100 then
    raise exception 'invalid_name';
  end if;

  -- Same phone and email rules as booking.
  if v_verified_phone is not null then
    if public.phone_key(v_phone) is distinct from v_verified_phone or char_length(v_phone) > 30 then
      v_phone := '+' || v_verified_phone;
    end if;
    v_phone_key := v_verified_phone;
    v_contact_email := coalesce(v_email, nullif(lower(trim(coalesce(p_email, ''))), ''));
    if v_contact_email is not null
      and (char_length(v_contact_email) > 254 or v_contact_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') then
      raise exception 'invalid_email';
    end if;
  else
    v_phone_key := public.phone_key(v_phone);
    if v_phone_key is null or char_length(v_phone) > 30 then
      raise exception 'invalid_phone';
    end if;
    v_contact_email := v_email;
  end if;

  -- Messages go by email (texts only if they asked for them).
  if v_contact_email is null and not coalesce(p_text_ok, false) then
    raise exception 'email_required';
  end if;
  if not (v_days <@ '{0,1,2,3,4,5,6}'::smallint[]) or not (v_times <@ '{morning,afternoon,evening}'::text[]) then
    raise exception 'invalid_choice';
  end if;

  select * into v_stylist from public.stylists where slug = lower(p_slug);
  if not found then
    raise exception 'not_found';
  end if;
  if not v_stylist.waitlist_enabled then
    raise exception 'waitlist_off';
  end if;

  select * into v_service from public.services
  where id = p_service_id and stylist_id = v_stylist.id;
  if not found then
    raise exception 'not_found';
  end if;

  perform public.apply_auto_regulars(v_stylist.id);
  v_status := public.booking_viewer_status(v_stylist.id);

  if v_status = 'blocked' or exists (
    select 1 from public.clients c
    where c.stylist_id = v_stylist.id
      and c.status = 'blocked'
      and (
        public.phone_key(c.phone) = v_phone_key
        or (v_contact_email is not null and lower(c.email) = v_contact_email)
      )
  ) then
    raise exception 'blocked';
  end if;

  -- Same lock as the scan, and note what's free right now, so only times that
  -- open up from here on count as new for this client.
  perform pg_advisory_xact_lock(hashtext('waitlist:' || v_stylist.id::text));
  perform public.waitlist_sync_free_time(v_stylist.id);

  select e.id into v_entry_id
  from public.waitlist_entries e
  where e.stylist_id = v_stylist.id
    and e.service_id = v_service.id
    and e.user_id = auth.uid()
    and e.status = 'waiting';
  v_updated := v_entry_id is not null;

  if v_updated then
    update public.waitlist_entries
    set name = v_name,
        phone = v_phone,
        email = v_contact_email,
        verified_phone = v_verified_phone,
        verified_email = v_email,
        days = v_days,
        times = v_times,
        text_ok = coalesce(p_text_ok, false),
        watch_from = now()
    where id = v_entry_id;
  else
    select count(*) into v_waiting
    from public.waitlist_entries e
    where e.stylist_id = v_stylist.id and e.user_id = auth.uid() and e.status = 'waiting';
    if v_waiting >= 3 then
      raise exception 'too_many_waitlist';
    end if;

    insert into public.waitlist_entries (
      stylist_id, service_id, user_id, name, phone, email,
      verified_phone, verified_email, days, times, text_ok
    )
    values (
      v_stylist.id, v_service.id, auth.uid(), v_name, v_phone, v_contact_email,
      v_verified_phone, v_email, v_days, v_times, coalesce(p_text_ok, false)
    )
    returning id into v_entry_id;
  end if;

  select count(*) into v_matching
  from public.booking_open_slots(v_stylist.id, v_service.duration_minutes, v_status) s
  where public.waitlist_wants(v_days, v_times, s.slot_date, s.slot_time);

  return jsonb_build_object(
    'updated', v_updated,
    'email', v_contact_email,
    'matching', v_matching
  );
end;
$$;

-- Public, with the secret link from a waitlist message: their waitlist spot,
-- and the times they were told about that are still open.
create or replace function public.get_waitlist_entry(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_entry public.waitlist_entries;
  v_stylist public.stylists;
  v_service public.services;
  v_open timestamp[] := '{}';
begin
  select * into v_entry from public.waitlist_entries where manage_token = p_token;
  if not found then
    return null;
  end if;
  select * into v_stylist from public.stylists where id = v_entry.stylist_id;
  select * into v_service from public.services where id = v_entry.service_id;

  if v_entry.status = 'waiting' then
    select coalesce(array_agg(s.slot_date + s.slot_time), '{}')
    into v_open
    from public.booking_open_slots(v_stylist.id, v_service.duration_minutes, public.client_status(v_entry)) s;
  end if;

  return jsonb_build_object(
    'status', v_entry.status,
    'name', v_entry.name,
    'email', v_entry.email,
    'days', to_jsonb(v_entry.days),
    'times', to_jsonb(v_entry.times),
    'business_name', v_stylist.business_name,
    'slug', v_stylist.slug,
    'timezone', v_stylist.timezone,
    'service_name', v_service.name,
    'offers', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'claim_token', o.claim_token,
            'slot_date', o.slot_date,
            'slot_time', o.slot_time
          )
          order by o.slot_date, o.slot_time
        )
        from public.waitlist_offers o
        where o.entry_id = v_entry.id
          and o.notified_at is not null
          and o.booking_id is null
          and (o.slot_date + o.slot_time) = any (v_open)
      ),
      '[]'::jsonb
    )
  );
end;
$$;

-- Public, with the secret link: leave the waitlist.
create or replace function public.leave_waitlist(p_token text)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with left_list as (
    update public.waitlist_entries
    set status = 'removed', ended_at = now()
    where manage_token = p_token and status = 'waiting'
    returning id
  ),
  untold as (
    delete from public.waitlist_offers o
    using left_list l
    where o.entry_id = l.id and o.notified_at is null
  )
  select exists (select 1 from left_list)
$$;

-- Public, with the secret "Claim this time" link: what the time is, and
-- whether it can still be claimed.
-- state: 'open', 'taken' (someone else got it, or it's closed), 'claimed'
-- (this link already booked it) or 'ended' (no longer on the waitlist).
create or replace function public.get_waitlist_offer(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_offer public.waitlist_offers;
  v_entry public.waitlist_entries;
  v_stylist public.stylists;
  v_service public.services;
  v_state text;
begin
  select * into v_offer from public.waitlist_offers where claim_token = p_token;
  if not found then
    return null;
  end if;
  select * into v_entry from public.waitlist_entries where id = v_offer.entry_id;
  select * into v_stylist from public.stylists where id = v_offer.stylist_id;
  select * into v_service from public.services where id = v_entry.service_id;

  if v_offer.booking_id is not null and exists (
    select 1 from public.bookings b where b.id = v_offer.booking_id and b.status = 'confirmed'
  ) then
    v_state := 'claimed';
  elsif v_entry.status <> 'waiting' then
    v_state := 'ended';
  elsif v_offer.notified_at is not null and exists (
    select 1
    from public.booking_open_slots(v_stylist.id, v_service.duration_minutes, public.client_status(v_entry)) s
    where s.slot_date = v_offer.slot_date and s.slot_time = v_offer.slot_time
  ) then
    v_state := 'open';
  else
    v_state := 'taken';
  end if;

  return jsonb_build_object(
    'state', v_state,
    'business_name', v_stylist.business_name,
    'slug', v_stylist.slug,
    'timezone', v_stylist.timezone,
    'cancellation_policy', v_stylist.cancellation_policy,
    'service_name', v_service.name,
    'price_cents', v_service.price_cents,
    'deposit_cents', public.service_deposit_cents(v_stylist, v_service),
    'slot_date', v_offer.slot_date,
    'slot_time', v_offer.slot_time,
    'end_time', v_offer.end_time,
    'client_name', v_entry.name,
    'manage_token', v_entry.manage_token
  );
end;
$$;

-- Public, with the secret link: claim the time. Booked exactly like the
-- booking page would (same checks, same deposit step), in the name of the
-- client who joined the waitlist. The first to claim gets it.
create or replace function public.claim_waitlist_offer(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_offer public.waitlist_offers;
  v_entry public.waitlist_entries;
  v_stylist public.stylists;
  v_service public.services;
  v_status text;
  v_client_id uuid;
  v_upcoming integer;
  v_booking_id uuid;
  v_deposit integer;
  v_booking_status text;
begin
  select * into v_offer from public.waitlist_offers where claim_token = p_token;
  if not found then
    raise exception 'slot_unavailable';
  end if;

  -- Same lock as booking, so two claims (or a claim and a booking) can't race.
  perform pg_advisory_xact_lock(hashtext(v_offer.stylist_id::text));

  select * into v_offer from public.waitlist_offers where id = v_offer.id for update;
  select * into v_entry from public.waitlist_entries where id = v_offer.entry_id;
  select * into v_stylist from public.stylists where id = v_offer.stylist_id;
  select * into v_service from public.services where id = v_entry.service_id;

  if v_offer.booking_id is not null and exists (
    select 1 from public.bookings b where b.id = v_offer.booking_id and b.status = 'confirmed'
  ) then
    raise exception 'already_claimed';
  end if;
  if v_entry.status <> 'waiting' then
    raise exception 'waitlist_ended';
  end if;
  if v_offer.notified_at is null then
    raise exception 'slot_unavailable';
  end if;

  -- Release unpaid holds that ran out of time, plus this client's own unpaid
  -- holds (they left the payment page and are trying again).
  update public.bookings
  set status = 'expired'
  where stylist_id = v_stylist.id
    and status = 'pending_payment'
    and (hold_expires_at <= now() or booked_by = v_entry.user_id);

  perform public.apply_auto_regulars(v_stylist.id);
  v_status := public.client_status(v_entry);

  if v_status = 'blocked' or exists (
    select 1 from public.clients c
    where c.stylist_id = v_stylist.id
      and c.status = 'blocked'
      and (
        public.phone_key(c.phone) = public.phone_key(v_entry.phone)
        or (v_entry.email is not null and lower(c.email) = v_entry.email)
      )
  ) then
    raise exception 'blocked';
  end if;

  if not exists (
    select 1
    from public.booking_open_slots(v_stylist.id, v_service.duration_minutes, v_status) o
    where o.slot_date = v_offer.slot_date and o.slot_time = v_offer.slot_time
  ) then
    raise exception 'slot_unavailable';
  end if;

  select count(*) into v_upcoming
  from public.bookings b
  where b.stylist_id = v_stylist.id
    and b.booked_by = v_entry.user_id
    and b.status = 'confirmed'
    and b.booking_date + b.start_time > now() at time zone v_stylist.timezone;
  if v_upcoming >= 3 then
    raise exception 'too_many_bookings';
  end if;

  -- Find them on the client list by what they proved (Regular first), or add them as New.
  select c.id into v_client_id
  from public.clients c
  where c.stylist_id = v_stylist.id
    and (
      (v_entry.verified_phone is not null and public.phone_key(c.phone) = v_entry.verified_phone)
      or (v_entry.verified_email is not null and lower(c.email) = v_entry.verified_email)
    )
  order by case c.status when 'regular' then 0 else 1 end
  limit 1;

  if v_client_id is null then
    insert into public.clients (stylist_id, name, phone, email, status)
    values (v_stylist.id, v_entry.name, v_entry.phone, v_entry.email, 'new')
    returning id into v_client_id;
  end if;

  v_deposit := public.service_deposit_cents(v_stylist, v_service);
  v_booking_status := case when v_deposit > 0 then 'pending_payment' else 'confirmed' end;

  insert into public.bookings (
    stylist_id, service_id, client_id, service_name, price_cents,
    booking_date, start_time, end_time, client_name, client_email, client_phone,
    status, deposit_cents, deposit_status, hold_expires_at, cancellation_policy, booked_by
  )
  values (
    v_stylist.id, v_service.id, v_client_id, v_service.name, v_service.price_cents,
    v_offer.slot_date, v_offer.slot_time,
    v_offer.slot_time + make_interval(mins => v_service.duration_minutes),
    v_entry.name, v_entry.email, v_entry.phone,
    v_booking_status,
    v_deposit,
    case when v_deposit > 0 then 'unpaid' else 'none' end,
    case when v_deposit > 0 then now() + interval '35 minutes' end,
    v_stylist.cancellation_policy,
    v_entry.user_id
  )
  returning id into v_booking_id;

  update public.waitlist_offers
  set booking_id = v_booking_id, claimed_at = now()
  where id = v_offer.id;

  -- With a deposit, they come off the waitlist once it's paid (the next scan
  -- sees the confirmed booking).
  if v_booking_status = 'confirmed' then
    update public.waitlist_entries
    set status = 'booked', ended_at = now()
    where id = v_entry.id;
  end if;

  return jsonb_build_object(
    'id', v_booking_id,
    'status', v_booking_status,
    'deposit_cents', v_deposit,
    'stylist_id', v_stylist.id,
    'business_name', v_stylist.business_name,
    'service_name', v_service.name,
    'booking_date', v_offer.slot_date,
    'start_time', v_offer.slot_time,
    'end_time', v_offer.slot_time + make_interval(mins => v_service.duration_minutes)
  );
exception
  when exclusion_violation then
    raise exception 'slot_unavailable';
end;
$$;

-- ============ CLIENTS CANCELLING THEIR OWN BOOKINGS ============

-- Public: the visitor's upcoming bookings with this stylist (they must have
-- confirmed their phone or email with a code).
create or replace function public.get_my_bookings(p_slug text)
returns table (
  id uuid,
  service_name text,
  booking_date date,
  start_time time,
  end_time time,
  deposit_cents integer,
  deposit_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.service_name, b.booking_date, b.start_time, b.end_time, b.deposit_cents, b.deposit_status
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

-- Public: cancel one of your own upcoming bookings. The time opens up again
-- (and the waitlist hears about it). Deposits aren't refunded automatically.
create or replace function public.cancel_my_booking(p_slug text, p_booking_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  if auth.uid() is null then
    raise exception 'not_verified';
  end if;

  update public.bookings b
  set status = 'cancelled'
  from public.stylists s
  where b.id = p_booking_id
    and s.id = b.stylist_id
    and s.slug = lower(p_slug)
    and (
      b.booked_by = auth.uid()
      or (b.booked_by is null and lower(b.client_email) = public.booking_verified_email())
    )
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

-- ============ WHO CAN CALL WHAT ============

-- Internal helpers.
revoke execute on function public.waitlist_token() from public, anon, authenticated;
revoke execute on function public.waitlist_part_of_day(time) from public, anon, authenticated;
revoke execute on function public.waitlist_wants(smallint[], text[], date, time) from public, anon, authenticated;
revoke execute on function public.waitlist_sync_free_time(uuid) from public, anon, authenticated;
revoke execute on function public.waitlist_scan(uuid) from public, anon, authenticated;
revoke execute on function public.waitlist_note_booking() from public, anon, authenticated;

-- Stylists (logged in) can read a waitlisted client's status.
revoke execute on function public.client_status(public.waitlist_entries) from public, anon;
grant execute on function public.client_status(public.waitlist_entries) to authenticated;

-- Only the app's server may call these.
revoke execute on function public.waitlist_process(uuid) from public, anon, authenticated;
revoke execute on function public.waitlist_unmark(uuid[]) from public, anon, authenticated;
grant execute on function public.waitlist_process(uuid) to service_role;
grant execute on function public.waitlist_unmark(uuid[]) to service_role;

-- The public booking page functions.
revoke execute on function public.get_booking_page(text) from public;
revoke execute on function public.join_waitlist(text, uuid, text, text, text, smallint[], text[], boolean) from public;
revoke execute on function public.get_waitlist_entry(text) from public;
revoke execute on function public.leave_waitlist(text) from public;
revoke execute on function public.get_waitlist_offer(text) from public;
revoke execute on function public.claim_waitlist_offer(text) from public;
revoke execute on function public.get_my_bookings(text) from public;
revoke execute on function public.cancel_my_booking(text, uuid) from public;
grant execute on function public.get_booking_page(text) to anon, authenticated;
grant execute on function public.join_waitlist(text, uuid, text, text, text, smallint[], text[], boolean) to anon, authenticated;
grant execute on function public.get_waitlist_entry(text) to anon, authenticated;
grant execute on function public.leave_waitlist(text) to anon, authenticated;
grant execute on function public.get_waitlist_offer(text) to anon, authenticated;
grant execute on function public.claim_waitlist_offer(text) to anon, authenticated;
grant execute on function public.get_my_bookings(text) to anon, authenticated;
grant execute on function public.cancel_my_booking(text, uuid) to anon, authenticated;

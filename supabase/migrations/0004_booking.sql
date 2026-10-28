-- Step 4: openings, bookings and the public booking page.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.

-- Needed so the database itself can refuse two bookings at the same time.
create extension if not exists btree_gist with schema extensions;

-- ============ STYLISTS: booking link + time zone ============
alter table public.stylists add column if not exists slug text;
alter table public.stylists add column if not exists timezone text not null default 'America/New_York';

-- "Cuts by Sam" + id -> "cuts-by-sam-1a2b3c"
create or replace function public.make_stylist_slug(p_name text, p_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(
      trim(both '-' from left(
        trim(both '-' from regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g')),
        30
      )),
      ''
    ),
    'stylist'
  ) || '-' || left(replace(p_id::text, '-', ''), 6)
$$;

update public.stylists
set slug = public.make_stylist_slug(business_name, id)
where slug is null;

alter table public.stylists alter column slug set not null;
alter table public.stylists drop constraint if exists stylists_slug_format;
alter table public.stylists add constraint stylists_slug_format
  check (char_length(slug) between 3 and 40 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
create unique index if not exists stylists_slug_key on public.stylists (slug);

-- Clients who verify with an email code also get a login, but they are
-- not stylists. Only sign-ups with a business name get a stylist profile.
create or replace function public.handle_new_stylist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(trim(new.raw_user_meta_data ->> 'business_name'), '');
begin
  if v_name is null then
    return new;
  end if;

  insert into public.stylists (id, business_name, slug)
  values (new.id, v_name, public.make_stylist_slug(v_name, new.id));
  return new;
end;
$$;

-- ============ OPENINGS ============
-- Times the stylist has opened for booking, in the stylist's own time zone.
-- visibility: 'everyone', or 'regulars' (hidden from everyone else).
create table if not exists public.openings (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  opening_date date not null,
  start_time time not null,
  end_time time not null,
  visibility text not null default 'everyone' check (visibility in ('everyone', 'regulars')),
  created_at timestamptz not null default now(),
  constraint opening_end_after_start check (end_time > start_time),
  constraint openings_no_overlap exclude using gist (
    stylist_id with =,
    tsrange(opening_date + start_time, opening_date + end_time) with &&
  )
);

create index if not exists openings_stylist_date_idx on public.openings (stylist_id, opening_date);

alter table public.openings enable row level security;

-- Only the stylist can read their openings directly. The public booking page
-- never reads this table; it goes through the functions further down.
drop policy if exists "Stylists can view own openings" on public.openings;
create policy "Stylists can view own openings"
  on public.openings for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can add own openings" on public.openings;
create policy "Stylists can add own openings"
  on public.openings for insert
  to authenticated
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can update own openings" on public.openings;
create policy "Stylists can update own openings"
  on public.openings for update
  to authenticated
  using ((select auth.uid()) = stylist_id)
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can delete own openings" on public.openings;
create policy "Stylists can delete own openings"
  on public.openings for delete
  to authenticated
  using ((select auth.uid()) = stylist_id);

-- ============ BOOKINGS ============
-- Service and client details are copied in, so a booking still makes sense
-- if the service or client is later changed or deleted.
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  service_name text not null,
  price_cents integer not null,
  booking_date date not null,
  start_time time not null,
  end_time time not null,
  client_name text not null,
  client_email text not null,
  client_phone text not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint booking_end_after_start check (end_time > start_time),
  constraint bookings_no_double_booking exclude using gist (
    stylist_id with =,
    tsrange(booking_date + start_time, booking_date + end_time) with &&
  ) where (status = 'confirmed')
);

create index if not exists bookings_stylist_date_idx on public.bookings (stylist_id, booking_date);

alter table public.bookings enable row level security;

-- Stylists can see and cancel their bookings. Nobody can add bookings
-- directly: they're only created by create_booking() below.
drop policy if exists "Stylists can view own bookings" on public.bookings;
create policy "Stylists can view own bookings"
  on public.bookings for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can update own bookings" on public.bookings;
create policy "Stylists can update own bookings"
  on public.bookings for update
  to authenticated
  using ((select auth.uid()) = stylist_id)
  with check ((select auth.uid()) = stylist_id);

-- ============ BOOKING RULES (used by the public page) ============

-- The visitor's email, but only if they proved it with an email code or link.
-- A password login doesn't count, so nobody can pose as a regular by
-- signing up with someone else's email address.
create or replace function public.booking_verified_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(u.email)
  from auth.users u
  where u.id = auth.uid()
    and u.email_confirmed_at is not null
    and exists (
      select 1
      from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) as a(claim)
      where a.claim ->> 'method' in ('otp', 'magiclink', 'email/signup')
    )
$$;

-- Who is looking at this stylist's booking page?
-- 'anonymous' (not verified), 'unknown' (verified, not on the client list),
-- or their client status: 'regular', 'new' or 'blocked'.
create or replace function public.booking_viewer_status(p_stylist_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when v.email is null then 'anonymous'
    else coalesce(
      (
        select c.status
        from public.clients c
        where c.stylist_id = p_stylist_id and lower(c.email) = v.email
        order by case c.status when 'blocked' then 0 when 'regular' then 1 else 2 end
        limit 1
      ),
      'unknown'
    )
  end
  from (select public.booking_verified_email() as email) v
$$;

-- Every start time (every 15 minutes) that fits the service length inside an
-- opening, isn't on a blocked date, doesn't overlap a booking, and is at
-- least an hour away. Regulars-only openings are left out unless the
-- viewer is a regular. Blocked clients get nothing.
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
      and bk.status = 'confirmed'
      and bk.booking_date + bk.start_time < c.slot_start + make_interval(mins => p_duration)
      and bk.booking_date + bk.end_time > c.slot_start
  )
$$;

-- Public: the stylist's name, services, and who the visitor is.
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
    'viewer_status', public.booking_viewer_status(s.id),
    'viewer_email', public.booking_verified_email(),
    'services', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', sv.id,
            'name', sv.name,
            'price_cents', sv.price_cents,
            'duration_minutes', sv.duration_minutes
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

-- Public: open times for one service, as this visitor is allowed to see them.
create or replace function public.get_open_slots(p_slug text, p_service_id uuid)
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
    s.id, sv.duration_minutes, public.booking_viewer_status(s.id)
  ) o
  where s.slug = lower(p_slug)
  order by 1, 2
$$;

-- Public: book a time. The visitor must have verified their email.
-- Everything is checked again here, so the page can't be tricked.
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

  insert into public.bookings (
    stylist_id, service_id, client_id, service_name, price_cents,
    booking_date, start_time, end_time, client_name, client_email, client_phone
  )
  values (
    v_stylist.id, v_service.id, v_client_id, v_service.name, v_service.price_cents,
    p_date, p_time, v_end, v_name, v_email, v_phone
  )
  returning id into v_booking_id;

  return jsonb_build_object(
    'id', v_booking_id,
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

-- The helper functions are for internal use only.
revoke execute on function public.make_stylist_slug(text, uuid) from public, anon, authenticated;
revoke execute on function public.booking_verified_email() from public, anon, authenticated;
revoke execute on function public.booking_viewer_status(uuid) from public, anon, authenticated;
revoke execute on function public.booking_open_slots(uuid, integer, text) from public, anon, authenticated;

-- The three functions the public booking page is allowed to call.
grant execute on function public.get_booking_page(text) to anon, authenticated;
grant execute on function public.get_open_slots(text, uuid) to anon, authenticated;
grant execute on function public.create_booking(text, uuid, date, time, text, text) to anon, authenticated;

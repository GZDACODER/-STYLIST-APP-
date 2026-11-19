-- Step 46: client sign-in with Pro ID + phone, and the client home.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0050_pro_codes.sql first. Running this again later is safe.
--
-- A client signs in at /client with the pro's ID code (step 45) and their
-- phone number. The first time on a device, a one-time code goes to the email
-- the pro has for them; after that the device stays signed in. Their home
-- shows their visits, Book my usual, reschedule/cancel, running late, add to
-- calendar, Regular status, My look (a photo and notes the pro shares),
-- birthday perks, aftercare tips and one-tap feedback.
--
-- Everything a client sees goes through the functions below, which check
-- the signed-in client is really that pro's client. Pros see only their own.

-- ============ SIGN-IN ATTEMPTS AND RATE LIMITS (server only) ============
create table if not exists public.client_signin_attempts (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid references public.stylists (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  email text,
  tries integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',
  used_at timestamptz
);
alter table public.client_signin_attempts enable row level security;
revoke all on public.client_signin_attempts from anon, authenticated;

create table if not exists public.rate_events (
  bucket text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_events_bucket_idx on public.rate_events (bucket, created_at);
alter table public.rate_events enable row level security;
revoke all on public.rate_events from anon, authenticated;

-- Notes one attempt in a bucket ("signin-ip:<hash>", "signin:<code>:<phone>").
-- True if it's within p_max attempts in the last p_window.
create or replace function public.rate_ok(p_bucket text, p_max integer, p_window interval)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from public.rate_events where created_at < now() - interval '1 day';
  insert into public.rate_events (bucket) values (left(p_bucket, 200));
  select count(*) into n from public.rate_events
  where bucket = left(p_bucket, 200) and created_at > now() - p_window;
  return n <= p_max;
end;
$$;

-- Sign-in step 1 (server only): the pro and client for an ID code + phone.
-- Nothing (no rows) if either doesn't match, or the client has no email.
create or replace function public.client_signin_lookup(p_code text, p_phone text)
returns table (stylist_id uuid, client_id uuid, email text, business_name text, pro_code text)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, c.id, lower(c.email), s.business_name, s.pro_code
  from public.stylists s
  join public.clients c on c.stylist_id = s.id
  where s.pro_code = public.clean_pro_code(p_code)
    and public.phone_key(c.phone) = public.phone_key(p_phone)
    and public.phone_key(p_phone) is not null
    and c.status <> 'blocked'
    and coalesce(c.email, '') like '%@%'
  order by c.created_at
  limit 1
$$;

-- "Forgot ID code" (server only): the pros a client email books with.
create or replace function public.client_pros_for_email(p_email text)
returns table (business_name text, pro_code text, client_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct on (s.id) s.business_name, s.pro_code, c.name
  from public.clients c
  join public.stylists s on s.id = c.stylist_id
  where lower(c.email) = lower(trim(p_email))
    and c.status <> 'blocked'
  order by s.id, c.created_at
  limit 20
$$;

revoke execute on function public.rate_ok(text, integer, interval) from public, anon, authenticated;
revoke execute on function public.client_signin_lookup(text, text) from public, anon, authenticated;
revoke execute on function public.client_pros_for_email(text) from public, anon, authenticated;
grant execute on function public.rate_ok(text, integer, interval) to service_role;
grant execute on function public.client_signin_lookup(text, text) to service_role;
grant execute on function public.client_pros_for_email(text) to service_role;

-- ============ NEW COLUMNS ============
-- My look: a photo of the style and notes the pro chooses to share.
alter table public.bookings add column if not exists look_photo_path text;
alter table public.bookings add column if not exists shared_note text;
alter table public.bookings drop constraint if exists bookings_shared_note_length;
alter table public.bookings add constraint bookings_shared_note_length check (char_length(shared_note) <= 1000);
-- The after-visit email (aftercare tips + "how was it?"), sent once.
alter table public.bookings add column if not exists after_visit_sent_at timestamptz;

-- Birthdays ("MM-DD", no year) and the pro's perks.
alter table public.clients add column if not exists birthday text;
alter table public.clients drop constraint if exists clients_birthday_format;
alter table public.clients add constraint clients_birthday_format
  check (birthday is null or birthday ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');
alter table public.clients add column if not exists birthday_sent_year integer;
alter table public.stylists add column if not exists birthday_perk text not null default '';
alter table public.stylists add column if not exists regular_perks text not null default '';
alter table public.stylists drop constraint if exists stylists_perks_length;
alter table public.stylists add constraint stylists_perks_length
  check (char_length(birthday_perk) <= 300 and char_length(regular_perks) <= 300);
grant update (birthday_perk, regular_perks) on public.stylists to authenticated;

-- Aftercare tips per service, emailed after the visit.
alter table public.services add column if not exists aftercare text not null default '';
alter table public.services drop constraint if exists services_aftercare_length;
alter table public.services add constraint services_aftercare_length check (char_length(aftercare) <= 2000);
grant update (aftercare) on public.services to authenticated;

grant update (look_photo_path, shared_note) on public.bookings to authenticated;

-- ============ RUNNING LATE ============
create table if not exists public.late_notices (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  minutes integer not null check (minutes in (5, 10, 15)),
  created_at timestamptz not null default now(),
  seen_at timestamptz
);
create index if not exists late_notices_stylist_idx on public.late_notices (stylist_id, created_at desc);
alter table public.late_notices enable row level security;
revoke all on public.late_notices from anon;
grant select, update (seen_at) on public.late_notices to authenticated;
drop policy if exists "Pros see their late notices" on public.late_notices;
create policy "Pros see their late notices" on public.late_notices for select to authenticated
  using ((select auth.uid()) = stylist_id);
drop policy if exists "Pros mark late notices seen" on public.late_notices;
create policy "Pros mark late notices seen" on public.late_notices for update to authenticated
  using ((select auth.uid()) = stylist_id) with check ((select auth.uid()) = stylist_id);

-- ============ FEEDBACK (pro only sees it) ============
create table if not exists public.visit_feedback (
  booking_id uuid primary key references public.bookings (id) on delete cascade,
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);
create index if not exists visit_feedback_stylist_idx on public.visit_feedback (stylist_id, created_at desc);
alter table public.visit_feedback enable row level security;
revoke all on public.visit_feedback from anon;
grant select on public.visit_feedback to authenticated;
drop policy if exists "Pros see their feedback" on public.visit_feedback;
create policy "Pros see their feedback" on public.visit_feedback for select to authenticated
  using ((select auth.uid()) = stylist_id);

-- ============ PHOTOS FOR "MY LOOK" (private) ============
-- Private: clients only see a photo through a short-lived link made by the
-- server after it has checked the visit is theirs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-looks', 'client-looks', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Pros upload client looks" on storage.objects;
create policy "Pros upload client looks" on storage.objects for insert to authenticated
  with check (bucket_id = 'client-looks' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Pros see client looks" on storage.objects;
create policy "Pros see client looks" on storage.objects for select to authenticated
  using (bucket_id = 'client-looks' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "Pros delete client looks" on storage.objects;
create policy "Pros delete client looks" on storage.objects for delete to authenticated
  using (bucket_id = 'client-looks' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============ WHO THE SIGNED-IN CLIENT IS ============
-- The signed-in client's record with a pro: matched by the email or phone
-- they proved with a code. Null if they aren't that pro's client.
create or replace function public.my_client_for(p_stylist_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id
  from public.clients c
  where c.stylist_id = p_stylist_id
    and auth.uid() is not null
    and c.status <> 'blocked'
    and (
      (public.booking_verified_email() is not null and lower(c.email) = public.booking_verified_email())
      or (public.booking_verified_phone() is not null and public.phone_key(c.phone) = public.booking_verified_phone())
    )
  order by c.created_at
  limit 1
$$;

-- A booking belongs to the signed-in client.
create or replace function public.is_my_booking(b public.bookings)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    b.booked_by = auth.uid()
    or (public.booking_verified_email() is not null and lower(b.client_email) = public.booking_verified_email())
    or (b.client_id is not null and b.client_id = public.my_client_for(b.stylist_id))
  )
$$;

-- ============ THE CLIENT HOME ============
-- Everything for /client/<code>, or null if the signed-in client isn't one
-- of this pro's clients.
create or replace function public.client_home(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  s public.stylists;
  c public.clients;
  v_client uuid;
  v_now timestamp;
  v_visits integer;
  v_last jsonb;
  v_look jsonb;
  v_feedback jsonb;
begin
  select * into s from public.stylists where pro_code = public.clean_pro_code(p_code);
  if s.id is null then return null; end if;
  v_client := public.my_client_for(s.id);
  if v_client is null then return null; end if;
  select * into c from public.clients where id = v_client;
  v_now := now() at time zone s.timezone;
  v_visits := public.completed_visits(c);

  -- Their last visit that went ahead, for "Book my usual" and aftercare.
  select jsonb_build_object(
      'booking_id', b.id, 'date', b.booking_date, 'service_id', b.service_id, 'service_name', b.service_name,
      'minutes', extract(epoch from (b.end_time - b.start_time)) / 60,
      'service_active', sv.id is not null, 'aftercare', coalesce(sv.aftercare, ''))
    into v_last
  from public.bookings b
  left join public.services sv on sv.id = b.service_id
  where b.stylist_id = s.id and b.status = 'confirmed' and coalesce(b.outcome, '') <> 'no_show'
    and b.booking_date + b.end_time <= v_now and public.is_my_booking(b)
  order by b.booking_date desc, b.start_time desc
  limit 1;

  -- My look: the latest visit with a photo or shared notes.
  select jsonb_build_object('booking_id', b.id, 'date', b.booking_date, 'service_name', b.service_name,
      'photo_path', b.look_photo_path, 'note', b.shared_note)
    into v_look
  from public.bookings b
  where b.stylist_id = s.id and b.status = 'confirmed'
    and (b.look_photo_path is not null or coalesce(b.shared_note, '') <> '')
    and public.is_my_booking(b)
  order by b.booking_date desc, b.start_time desc
  limit 1;

  -- Feedback: their latest visit in the last 30 days with none yet.
  select jsonb_build_object('booking_id', b.id, 'date', b.booking_date, 'service_name', b.service_name)
    into v_feedback
  from public.bookings b
  where b.stylist_id = s.id and b.status = 'confirmed' and coalesce(b.outcome, '') <> 'no_show'
    and b.booking_date + b.end_time <= v_now and b.booking_date >= (v_now - interval '30 days')::date
    and public.is_my_booking(b)
    and not exists (select 1 from public.visit_feedback f where f.booking_id = b.id)
  order by b.booking_date desc, b.start_time desc
  limit 1;

  return jsonb_build_object(
    'business_name', s.business_name,
    'slug', s.slug,
    'pro_code', s.pro_code,
    'timezone', s.timezone,
    'client_name', c.name,
    'status', c.status,
    'visits', v_visits,
    'regular_after', s.auto_regular_after,
    'regular_perks', s.regular_perks,
    'waitlist_on', coalesce((to_jsonb(s) ->> 'waitlist_enabled')::boolean, false),
    'policy', coalesce(to_jsonb(s) ->> 'cancellation_policy', ''),
    'birthday', c.birthday,
    'birthday_perk', s.birthday_perk,
    'last_visit', v_last,
    'look', v_look,
    'feedback_due', v_feedback
  );
end;
$$;

-- The signed-in client's birthday ("MM-DD", or empty to remove it).
create or replace function public.client_set_birthday(p_code text, p_birthday text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stylist uuid;
  v_client uuid;
  v_value text := nullif(trim(coalesce(p_birthday, '')), '');
begin
  select id into v_stylist from public.stylists where pro_code = public.clean_pro_code(p_code);
  v_client := public.my_client_for(v_stylist);
  if v_client is null then raise exception 'not_signed_in'; end if;
  if v_value is not null and v_value !~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then
    raise exception 'invalid_birthday';
  end if;
  update public.clients set birthday = v_value where id = v_client;
  return true;
end;
$$;

-- "Running late": 5, 10 or 15 (15+) minutes, for one of their visits today
-- that hasn't ended. One notice per visit every 10 minutes. Returns what
-- the pro's email needs.
create or replace function public.client_running_late(p_code text, p_booking_id uuid, p_minutes integer)
returns table (stylist_id uuid, client_name text, service_name text, start_time time, minutes integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  s public.stylists;
  b public.bookings;
begin
  select * into s from public.stylists where pro_code = public.clean_pro_code(p_code);
  select * into b from public.bookings where id = p_booking_id and stylist_id = s.id;
  if b.id is null or not public.is_my_booking(b) or b.status <> 'confirmed' then raise exception 'not_found'; end if;
  if p_minutes not in (5, 10, 15) then raise exception 'invalid_minutes'; end if;
  if b.booking_date <> (now() at time zone s.timezone)::date
     or b.booking_date + b.end_time <= now() at time zone s.timezone then
    raise exception 'not_today';
  end if;
  if exists (select 1 from public.late_notices n where n.booking_id = b.id and n.created_at > now() - interval '10 minutes') then
    raise exception 'too_soon';
  end if;
  insert into public.late_notices (booking_id, stylist_id, minutes) values (b.id, s.id, p_minutes);
  return query select s.id, b.client_name, b.service_name, b.start_time, p_minutes;
end;
$$;

-- One-tap feedback on one of their visits (once per visit).
create or replace function public.client_leave_feedback(p_code text, p_booking_id uuid, p_rating integer, p_comment text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.stylists;
  b public.bookings;
begin
  select * into s from public.stylists where pro_code = public.clean_pro_code(p_code);
  select * into b from public.bookings where id = p_booking_id and stylist_id = s.id;
  if b.id is null or not public.is_my_booking(b) then raise exception 'not_found'; end if;
  if p_rating not between 1 and 5 then raise exception 'invalid_rating'; end if;
  insert into public.visit_feedback (booking_id, stylist_id, client_id, rating, comment)
  values (b.id, s.id, b.client_id, p_rating, nullif(left(trim(coalesce(p_comment, '')), 1000), ''))
  on conflict (booking_id) do update set rating = excluded.rating,
    comment = coalesce(excluded.comment, public.visit_feedback.comment);
  return true;
end;
$$;

-- One-tap feedback from the after-visit email (the booking's secret token).
create or replace function public.feedback_by_token(p_token text, p_rating integer, p_comment text)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b public.bookings;
begin
  select * into b from public.bookings where cancel_token = p_token;
  if b.id is null then raise exception 'not_found'; end if;
  if p_rating not between 1 and 5 then raise exception 'invalid_rating'; end if;
  insert into public.visit_feedback (booking_id, stylist_id, client_id, rating, comment)
  values (b.id, b.stylist_id, b.client_id, p_rating, nullif(left(trim(coalesce(p_comment, '')), 1000), ''))
  on conflict (booking_id) do update set rating = excluded.rating,
    comment = coalesce(excluded.comment, public.visit_feedback.comment);
  return true;
end;
$$;

-- ============ EMAILS (every-minute check, server only) ============
-- After-visit emails due: visits that went ahead and ended 2 hours to 3 days
-- ago, not sent yet, with an email address. Aftercare tips if the service
-- has them, and "how was it?".
create or replace function public.after_visit_due()
returns table (booking_id uuid, stylist_id uuid, client_email text, client_name text, service_name text,
  booking_date date, business_name text, pro_code text, cancel_token text, aftercare text)
language sql
stable
security definer
set search_path = ''
as $$
  select b.id, b.stylist_id, b.client_email, b.client_name, b.service_name, b.booking_date, s.business_name,
    s.pro_code, b.cancel_token, coalesce(sv.aftercare, '')
  from public.bookings b
  join public.stylists s on s.id = b.stylist_id
  left join public.services sv on sv.id = b.service_id
  where b.status = 'confirmed'
    and b.after_visit_sent_at is null
    and coalesce(b.outcome, '') <> 'no_show'
    and coalesce(b.client_email, '') like '%@%'
    and b.booking_date + b.end_time <= (now() at time zone s.timezone) - interval '2 hours'
    and b.booking_date + b.end_time > (now() at time zone s.timezone) - interval '3 days'
    and b.cancel_token is not null
  order by b.booking_date
  limit 50
$$;

create or replace function public.after_visit_mark(p_booking_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.bookings set after_visit_sent_at = now() where id = p_booking_id;
$$;

-- Birthday perks due today (in the pro's time zone), once a year.
create or replace function public.birthday_perks_due()
returns table (client_id uuid, stylist_id uuid, client_email text, client_name text, business_name text,
  slug text, pro_code text, birthday_perk text, year integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, s.id, c.email, c.name, s.business_name, s.slug, s.pro_code, s.birthday_perk,
    extract(year from now() at time zone s.timezone)::integer
  from public.clients c
  join public.stylists s on s.id = c.stylist_id
  where c.birthday = to_char(now() at time zone s.timezone, 'MM-DD')
    and trim(s.birthday_perk) <> ''
    and c.status <> 'blocked'
    and coalesce(c.email, '') like '%@%'
    and c.birthday_sent_year is distinct from extract(year from now() at time zone s.timezone)::integer
    and extract(hour from now() at time zone s.timezone) >= 9
  limit 50
$$;

create or replace function public.birthday_mark(p_client_id uuid, p_year integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.clients set birthday_sent_year = p_year where id = p_client_id;
$$;

-- ============ WHO CAN CALL WHAT ============
revoke execute on function public.my_client_for(uuid) from public, anon, authenticated;
revoke execute on function public.is_my_booking(public.bookings) from public, anon, authenticated;
revoke execute on function public.client_home(text) from public;
revoke execute on function public.client_set_birthday(text, text) from public;
revoke execute on function public.client_running_late(text, uuid, integer) from public;
revoke execute on function public.client_leave_feedback(text, uuid, integer, text) from public;
grant execute on function public.client_home(text) to authenticated;
grant execute on function public.client_set_birthday(text, text) to authenticated;
grant execute on function public.client_running_late(text, uuid, integer) to authenticated;
grant execute on function public.client_leave_feedback(text, uuid, integer, text) to authenticated;

revoke execute on function public.feedback_by_token(text, integer, text) from public, anon, authenticated;
revoke execute on function public.after_visit_due() from public, anon, authenticated;
revoke execute on function public.after_visit_mark(uuid) from public, anon, authenticated;
revoke execute on function public.birthday_perks_due() from public, anon, authenticated;
revoke execute on function public.birthday_mark(uuid, integer) from public, anon, authenticated;
grant execute on function public.feedback_by_token(text, integer, text) to service_role;
grant execute on function public.after_visit_due() to service_role;
grant execute on function public.after_visit_mark(uuid) to service_role;
grant execute on function public.birthday_perks_due() to service_role;
grant execute on function public.birthday_mark(uuid, integer) to service_role;

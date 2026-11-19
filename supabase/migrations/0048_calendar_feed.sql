-- Step 43: Calendar sync (Google Calendar, iPhone Calendar, Outlook).
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Running this again later is safe.
--
-- Each pro gets a private calendar link (Settings -> Calendar sync). Their
-- phone's calendar app reads their bookings from it every few hours. The
-- link works without logging in, so it's a long random code; the pro can
-- reset it to switch the old link off.
create table if not exists public.calendar_feeds (
  stylist_id uuid primary key references public.stylists (id) on delete cascade,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  last_read_at timestamptz
);

alter table public.calendar_feeds enable row level security;
revoke all on public.calendar_feeds from anon, authenticated;

-- The logged-in pro's link code, made the first time it's asked for.
create or replace function public.my_calendar_feed()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text;
begin
  if auth.uid() is null or not exists (select 1 from public.stylists where id = auth.uid()) then
    return null;
  end if;
  insert into public.calendar_feeds (stylist_id) values (auth.uid())
  on conflict (stylist_id) do nothing;
  select token into t from public.calendar_feeds where stylist_id = auth.uid();
  return t;
end;
$$;

-- A new code: the old link stops working.
create or replace function public.reset_my_calendar_feed()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  t text;
begin
  if auth.uid() is null or not exists (select 1 from public.stylists where id = auth.uid()) then
    return null;
  end if;
  insert into public.calendar_feeds (stylist_id, token)
  values (auth.uid(), encode(extensions.gen_random_bytes(24), 'hex'))
  on conflict (stylist_id) do update set token = excluded.token, created_at = now(), last_read_at = null
  returning token into t;
  return t;
end;
$$;

revoke execute on function public.my_calendar_feed() from public, anon;
revoke execute on function public.reset_my_calendar_feed() from public, anon;
grant execute on function public.my_calendar_feed() to authenticated;
grant execute on function public.reset_my_calendar_feed() to authenticated;

-- Step 53: "Manage my appointment" links (/v/<code> from every email).
--
-- client_activity: what clients did from their email links (cancelled,
--   moved, running late, opened...), shown on the pro's Today page.
-- visit_running_late(token, minutes): "I'm running late" from the link,
--   no sign-in. Same rules as the client home: today only, before the
--   visit ends, once every 10 minutes.
-- Server only (the site calls these with its secret key). Safe to run more
-- than once.

create table if not exists public.client_activity (
  id bigint generated always as identity primary key,
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  created_at timestamptz not null default now(),
  client_name text not null default '',
  action text not null check (action in ('cancelled', 'rescheduled', 'running_late', 'calendar', 'waiver_signed')),
  detail text check (char_length(detail) <= 300)
);
create index if not exists client_activity_stylist_idx on public.client_activity (stylist_id, created_at desc);
alter table public.client_activity enable row level security;
drop policy if exists "Pros see their client activity" on public.client_activity;
create policy "Pros see their client activity" on public.client_activity
  for select to authenticated using ((select auth.uid()) = stylist_id);
grant select on public.client_activity to authenticated;

create or replace function public.visit_running_late(p_token text, p_minutes integer)
returns table (stylist_id uuid, client_name text, service_name text, start_time time, minutes integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  b public.bookings;
  s public.stylists;
begin
  if p_token !~ '^[0-9a-f]{64}$' then raise exception 'not_found'; end if;
  select * into b from public.bookings where cancel_token = p_token;
  if b.id is null or b.status <> 'confirmed' then raise exception 'not_found'; end if;
  select * into s from public.stylists where id = b.stylist_id;
  if p_minutes not in (5, 10, 15) then raise exception 'invalid_minutes'; end if;
  if b.booking_date <> (now() at time zone s.timezone)::date
     or b.booking_date + b.end_time <= now() at time zone s.timezone then
    raise exception 'not_today';
  end if;
  if exists (select 1 from public.late_notices n where n.booking_id = b.id and n.created_at > now() - interval '10 minutes') then
    raise exception 'too_soon';
  end if;
  insert into public.late_notices (booking_id, stylist_id, minutes) values (b.id, s.id, p_minutes);
  insert into public.client_activity (stylist_id, booking_id, client_name, action, detail)
  values (s.id, b.id, b.client_name, 'running_late', case when p_minutes >= 15 then '15+ minutes' else p_minutes || ' minutes' end);
  return query select s.id, b.client_name, b.service_name, b.start_time, p_minutes;
end;
$$;
revoke all on function public.visit_running_late(text, integer) from public, anon, authenticated;
grant execute on function public.visit_running_late(text, integer) to service_role;

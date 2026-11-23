-- Step 56: booking requests (approve before booking) and photos at booking.
--
-- services.request_first: clients send a request (idea, placement, size,
--   reference photos, when they're free) instead of picking a time; the pro
--   approves it (which emails a booking link only that client can use) or
--   declines with a note. Used by the Tattoo template; any pro can turn it on.
-- booking_requests: the requests. booking_photos: photos clients add when
--   booking (inspiration or reference). Photos are kept in private storage
--   ("booking-photos") and shown to the pro with short-lived links.
-- Safe to run more than once.

alter table public.services add column if not exists request_first boolean not null default false;
grant update (request_first) on public.services to authenticated;

create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  service_id uuid references public.services (id) on delete set null,
  service_name text not null default '',
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'approved', 'declined', 'booked')),
  client_name text not null check (char_length(client_name) between 1 and 100),
  client_email text not null check (client_email like '%@%' and char_length(client_email) <= 200),
  client_phone text check (char_length(client_phone) <= 40),
  idea text check (char_length(idea) <= 3000),
  placement text check (char_length(placement) <= 200),
  size text check (char_length(size) <= 200),
  availability text check (char_length(availability) <= 500),
  photos text[] not null default '{}',
  approved_service_id uuid references public.services (id) on delete set null,
  decided_at timestamptz,
  pro_note text check (char_length(pro_note) <= 1000),
  -- The booking link sent on approval: /book/<slug>?request=<token>.
  token text unique,
  booking_id uuid references public.bookings (id) on delete set null
);
create index if not exists booking_requests_stylist_idx on public.booking_requests (stylist_id, created_at desc);
alter table public.booking_requests enable row level security;
drop policy if exists "Pros see their requests" on public.booking_requests;
create policy "Pros see their requests" on public.booking_requests
  for select to authenticated using ((select auth.uid()) = stylist_id);
grant select on public.booking_requests to authenticated;
-- Approving/declining goes through the server (it also sends the email).

create table if not exists public.booking_photos (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  request_id uuid references public.booking_requests (id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);
create index if not exists booking_photos_booking_idx on public.booking_photos (booking_id);
alter table public.booking_photos enable row level security;
drop policy if exists "Pros see their booking photos" on public.booking_photos;
create policy "Pros see their booking photos" on public.booking_photos
  for select to authenticated using ((select auth.uid()) = stylist_id);
grant select on public.booking_photos to authenticated;

insert into storage.buckets (id, name, public) values ('booking-photos', 'booking-photos', false) on conflict (id) do nothing;

-- Client activity: a request sent.
alter table public.client_activity drop constraint if exists client_activity_action_check;
alter table public.client_activity add constraint client_activity_action_check
  check (action in ('cancelled', 'rescheduled', 'running_late', 'calendar', 'waiver_signed', 'requested'));

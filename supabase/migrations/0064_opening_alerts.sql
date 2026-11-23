-- Step 60: opening alerts ("Notify me" on a public profile). Clients follow
-- a pro and get an email when new times open that match what they want.
-- Regulars hear first; everyone else after the pro's head start
-- (stylists.waitlist_regulars_minutes). All writes go through the server.

create table if not exists public.profile_followers (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 200),
  phone text check (phone is null or char_length(phone) <= 40),
  wants text not null default 'any' check (wants in ('any', 'times', 'services')),
  days smallint[] not null default '{}',       -- 0 = Sunday ... 6 = Saturday
  parts text[] not null default '{}',          -- morning, afternoon, evening
  service_ids uuid[] not null default '{}',
  token text not null unique,                  -- one-tap unsubscribe
  code_hash text,
  code_expires_at timestamptz,
  code_tries smallint not null default 0,
  verified_at timestamptz,
  unsubscribed_at timestamptz,
  last_alert_at timestamptz,
  alerts_sent integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists profile_followers_one_per_email on public.profile_followers (stylist_id, lower(email));
create index if not exists profile_followers_active_idx on public.profile_followers (stylist_id)
  where verified_at is not null and unsubscribed_at is null;
alter table public.profile_followers enable row level security;
revoke all on public.profile_followers from anon, authenticated;
grant select (id, stylist_id, name, email, phone, wants, days, parts, service_ids, verified_at, unsubscribed_at, last_alert_at, alerts_sent, created_at)
  on public.profile_followers to authenticated;
drop policy if exists "Pros see their followers" on public.profile_followers;
create policy "Pros see their followers" on public.profile_followers for select to authenticated
  using ((select auth.uid()) = stylist_id);

-- The open times each pro had at the last check, so only new ones alert.
create table if not exists public.follower_alert_state (
  stylist_id uuid primary key references public.stylists (id) on delete cascade,
  seen_regular text[] not null default '{}',
  seen_public text[] not null default '{}',
  checked_at timestamptz not null default now()
);
alter table public.follower_alert_state enable row level security;
revoke all on public.follower_alert_state from anon, authenticated;

-- Alerts waiting to go out (regulars now, everyone else after the head start).
create table if not exists public.follower_alert_runs (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  audience text not null check (audience in ('regulars', 'everyone')),
  slots jsonb not null,
  due_at timestamptz not null,
  done_at timestamptz,
  sent integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists follower_alert_runs_due_idx on public.follower_alert_runs (due_at) where done_at is null;
alter table public.follower_alert_runs enable row level security;
revoke all on public.follower_alert_runs from anon, authenticated;

-- Tidy: finished runs after 30 days.
select cron.schedule('follower-alerts-tidy', '37 9 * * *',
  $job$ delete from public.follower_alert_runs where done_at < now() - interval '30 days' $job$);

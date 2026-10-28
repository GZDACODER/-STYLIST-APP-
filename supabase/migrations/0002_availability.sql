-- Step 2: working hours and blocked dates.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.

-- ============ WORKING HOURS ============
-- One row per stylist per day of the week.
-- weekday: 0 = Sunday, 1 = Monday ... 6 = Saturday.
create table if not exists public.working_hours (
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  is_working boolean not null default false,
  start_time time,
  end_time time,
  primary key (stylist_id, weekday),
  -- A working day needs a start and an end, and the end must be later.
  constraint working_day_has_hours check (
    not is_working
    or (start_time is not null and end_time is not null and end_time > start_time)
  )
);

alter table public.working_hours enable row level security;

drop policy if exists "Stylists can view own hours" on public.working_hours;
create policy "Stylists can view own hours"
  on public.working_hours for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can add own hours" on public.working_hours;
create policy "Stylists can add own hours"
  on public.working_hours for insert
  to authenticated
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can update own hours" on public.working_hours;
create policy "Stylists can update own hours"
  on public.working_hours for update
  to authenticated
  using ((select auth.uid()) = stylist_id)
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can delete own hours" on public.working_hours;
create policy "Stylists can delete own hours"
  on public.working_hours for delete
  to authenticated
  using ((select auth.uid()) = stylist_id);

-- ============ BLOCKED DATES ============
-- Specific dates the stylist isn't available (vacation, appointments, etc.).
create table if not exists public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  blocked_on date not null,
  reason text check (reason is null or char_length(reason) <= 100),
  created_at timestamptz not null default now(),
  unique (stylist_id, blocked_on)
);

alter table public.blocked_dates enable row level security;

drop policy if exists "Stylists can view own blocked dates" on public.blocked_dates;
create policy "Stylists can view own blocked dates"
  on public.blocked_dates for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can add own blocked dates" on public.blocked_dates;
create policy "Stylists can add own blocked dates"
  on public.blocked_dates for insert
  to authenticated
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can delete own blocked dates" on public.blocked_dates;
create policy "Stylists can delete own blocked dates"
  on public.blocked_dates for delete
  to authenticated
  using ((select auth.uid()) = stylist_id);

-- Step 51: business-type templates (lib/templates) and support access.
--
-- stylists.modules: the pro's own on/off choices for features (waitlist,
--   deposits, aftercare...), over their template's defaults. Empty = the
--   template's defaults, so nothing changes for existing accounts.
-- support_access: the pro's "Support access" switch (off by default). While
--   "until" is in the future, the Clientele team may help on their account.
-- support_log: every change made under support access, shown to the pro.
-- Safe to run more than once.

alter table public.stylists add column if not exists modules jsonb not null default '{}'::jsonb;
alter table public.stylists drop constraint if exists stylists_modules_object;
alter table public.stylists add constraint stylists_modules_object check (jsonb_typeof(modules) = 'object');
grant update (modules) on public.stylists to authenticated;

create table if not exists public.support_access (
  stylist_id uuid primary key references public.stylists (id) on delete cascade,
  until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.support_access enable row level security;
drop policy if exists "Pros see their support access" on public.support_access;
create policy "Pros see their support access" on public.support_access
  for select to authenticated using ((select auth.uid()) = stylist_id);
drop policy if exists "Pros set their support access" on public.support_access;
create policy "Pros set their support access" on public.support_access
  for insert to authenticated with check ((select auth.uid()) = stylist_id);
drop policy if exists "Pros change their support access" on public.support_access;
create policy "Pros change their support access" on public.support_access
  for update to authenticated using ((select auth.uid()) = stylist_id) with check ((select auth.uid()) = stylist_id);
grant select, insert, update on public.support_access to authenticated;

create table if not exists public.support_log (
  id bigint generated always as identity primary key,
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  created_at timestamptz not null default now(),
  actor text not null default 'Clientele support',
  action text not null check (char_length(action) <= 300),
  detail text check (char_length(detail) <= 2000)
);
create index if not exists support_log_stylist_idx on public.support_log (stylist_id, created_at desc);
alter table public.support_log enable row level security;
drop policy if exists "Pros see their support log" on public.support_log;
create policy "Pros see their support log" on public.support_log
  for select to authenticated using ((select auth.uid()) = stylist_id);
grant select on public.support_log to authenticated;
-- Only the server (support tools) writes to the log.

-- For support tools: may the team act on this pro's account right now?
create or replace function public.support_allowed(p_stylist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.support_access where stylist_id = p_stylist_id and until > now())
$$;
revoke all on function public.support_allowed(uuid) from public, anon, authenticated;
grant execute on function public.support_allowed(uuid) to service_role;

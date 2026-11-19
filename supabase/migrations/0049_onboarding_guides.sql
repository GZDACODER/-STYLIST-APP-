-- Step 44: first-visit tips (pop-up guides).
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Running this again later is safe.
--
-- The first time a pro opens a dashboard page, or a client reaches a step of
-- booking, a short guide shows. Once it's been shown (finished or skipped),
-- a row here stops it showing again, on every device. Settings -> Business
-- -> "Show tips again" deletes the pro's rows. Guide names are in
-- lib/guides.js. People see and change only their own rows.
create table if not exists public.onboarding_guides_seen (
  user_id uuid not null references auth.users (id) on delete cascade,
  guide_key text not null check (char_length(guide_key) between 1 and 40),
  seen_at timestamptz not null default now(),
  primary key (user_id, guide_key)
);

alter table public.onboarding_guides_seen enable row level security;
revoke all on public.onboarding_guides_seen from anon;
grant select, insert, delete on public.onboarding_guides_seen to authenticated;

drop policy if exists "See own seen guides" on public.onboarding_guides_seen;
create policy "See own seen guides"
  on public.onboarding_guides_seen for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Mark own guides seen" on public.onboarding_guides_seen;
create policy "Mark own guides seen"
  on public.onboarding_guides_seen for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Reset own guides" on public.onboarding_guides_seen;
create policy "Reset own guides"
  on public.onboarding_guides_seen for delete
  to authenticated
  using ((select auth.uid()) = user_id);

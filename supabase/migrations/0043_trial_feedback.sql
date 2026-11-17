-- Step 38: trial feedback.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0042_examples.sql first. Running this again later is safe.
--
-- During the 14-day trial, pros are asked a few short questions (Home card,
-- or Settings -> Plan & billing -> Share feedback). Answers are saved here;
-- the owner reads them all at /dashboard/admin/feedback (ADMIN_EMAILS in
-- Vercel) and gets each one by email. A pro can send feedback more than
-- once; each is its own row.
create table if not exists public.trial_feedback (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- 1 (poor) to 5 (excellent): "Overall, how is Clientele working for you?"
  rating smallint check (rating between 1 and 5),
  -- "After your trial, how likely are you to keep using Clientele?"
  keep_using text check (keep_using in ('definitely', 'probably', 'not_sure', 'probably_not')),
  needs_update text check (char_length(needs_update) <= 2000),
  easier text check (char_length(easier) <= 2000),
  notes text check (char_length(notes) <= 4000),
  -- Which day of the trial it was sent on (1-14), for context.
  trial_day smallint
);

create index if not exists trial_feedback_created_idx on public.trial_feedback (created_at desc);

alter table public.trial_feedback enable row level security;
revoke all on public.trial_feedback from anon;
grant select, insert on public.trial_feedback to authenticated;

drop policy if exists "Stylists can send feedback" on public.trial_feedback;
create policy "Stylists can send feedback"
  on public.trial_feedback for insert
  to authenticated
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can see their own feedback" on public.trial_feedback;
create policy "Stylists can see their own feedback"
  on public.trial_feedback for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

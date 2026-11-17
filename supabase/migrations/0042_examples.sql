-- Step 37: example data for new pros.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0041_plan_cancel_at.sql first. Running this again later is safe.
--
-- New pros see realistic example data in every dashboard tab (services,
-- clients, bookings, openings, waitlist, notes, events, intake...), each
-- tagged "Example", until they add their own. The examples are drawn by the
-- dashboard only (lib/examples.js): nothing fake is stored, so they can never
-- reach the booking page, emails, texts, Stripe, stats or limits.
--
-- This switch says whether to show them. Accounts that already exist get
-- false (no examples); every account made from now on gets true. Settings ->
-- Business has "Clear all examples" and "Restore examples".
alter table public.stylists add column if not exists show_examples boolean not null default false;
alter table public.stylists alter column show_examples set default true;
grant update (show_examples) on public.stylists to authenticated;

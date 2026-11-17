-- Step 36: show a cancelled plan on Plan & billing.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0040_standing_skip_closed_holidays.sql first. Running this again later is safe.
--
-- Cancelling in Stripe's billing page doesn't end the plan straight away: it
-- stops at the end of the period (or trial) and nothing more is charged.
-- Stripe's webhook now saves that here, so Settings can say "Your plan ends
-- on [date]" with a Reactivate button. Only Clientele's server writes these
-- (the existing "view own plan" rule lets the stylist read them).
alter table public.stylist_plans add column if not exists cancel_at_period_end boolean not null default false;
alter table public.stylist_plans add column if not exists cancel_at timestamptz;

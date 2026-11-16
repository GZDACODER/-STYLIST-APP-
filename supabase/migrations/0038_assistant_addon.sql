-- Step 33: the Assistant as a paid add-on ($15/month or $150/year).
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0037_claim_intake.sql first. Running this again later is safe.
--
-- Whether the account pays for the Assistant add-on, set from Stripe when the
-- subscription changes (lib/billing.js). Accounts in their free trial get the
-- Assistant without it. Founding (free) accounts pay for it like everyone else.
alter table public.stylist_plans add column if not exists assistant_active boolean not null default false;

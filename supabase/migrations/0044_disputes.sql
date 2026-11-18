-- Step 39: deposit dispute alerts.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0043_trial_feedback.sql first. Running this again later is safe.
--
-- When a client disputes a deposit with their bank (a chargeback), Stripe
-- tells Clientele's webhook. Each dispute is saved here with the booking it
-- belongs to, so the pro sees "Deposit disputed" on Home and the owner sees
-- every dispute at /dashboard/admin/disputes. Only Clientele's server writes
-- here; pros can read their own.
create table if not exists public.deposit_disputes (
  id text primary key,                  -- Stripe's dispute id (dp_...)
  booking_id uuid references public.bookings (id) on delete set null,
  stylist_id uuid references public.stylists (id) on delete cascade,
  payment_intent_id text,
  amount_cents integer not null default 0,
  reason text,
  -- Stripe's status: warning_needs_response, needs_response, under_review,
  -- won, lost, ...
  status text,
  evidence_due_by timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deposit_disputes_stylist_idx on public.deposit_disputes (stylist_id, created_at desc);

alter table public.deposit_disputes enable row level security;
revoke all on public.deposit_disputes from anon;
grant select on public.deposit_disputes to authenticated;

drop policy if exists "Stylists can see their own disputes" on public.deposit_disputes;
create policy "Stylists can see their own disputes"
  on public.deposit_disputes for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

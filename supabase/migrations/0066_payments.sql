-- Step 62: Money. Payments the pro records themselves (cash, Zelle, Cash App,
-- Venmo, card elsewhere): tips, product sales, balances paid and other
-- income. Visit prices and Stripe deposits are already in bookings.

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  client_name text check (client_name is null or char_length(client_name) <= 100),
  kind text not null check (kind in ('tip', 'product', 'balance', 'other')),
  method text not null check (method in ('cash', 'zelle', 'cashapp', 'venmo', 'card', 'check', 'other')),
  amount_cents integer not null check (amount_cents > 0 and amount_cents <= 10000000),
  paid_on date not null,
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index if not exists payments_stylist_day_idx on public.payments (stylist_id, paid_on desc);
create index if not exists payments_booking_idx on public.payments (booking_id) where booking_id is not null;
alter table public.payments enable row level security;
revoke all on public.payments from anon;
grant select, insert, delete on public.payments to authenticated;
drop policy if exists "Pros see their payments" on public.payments;
create policy "Pros see their payments" on public.payments for select to authenticated using ((select auth.uid()) = stylist_id);
drop policy if exists "Pros add their payments" on public.payments;
create policy "Pros add their payments" on public.payments for insert to authenticated with check ((select auth.uid()) = stylist_id);
drop policy if exists "Pros remove their payments" on public.payments;
create policy "Pros remove their payments" on public.payments for delete to authenticated using ((select auth.uid()) = stylist_id);

-- Balance reminders: when the last one went (so they aren't sent too often).
alter table public.bookings add column if not exists balance_reminded_at timestamptz;

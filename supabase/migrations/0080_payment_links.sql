-- Payment links (Money → Payment links): a pro asks a client to pay an
-- amount for something with a link they share anywhere. The client pays on
-- clientelesuite.com/pay/<token> through Stripe, straight to the pro's own
-- Stripe account minus the same fee as deposits (3% + 30¢). When Stripe
-- says it's paid, the server records it in payments (method 'link').
--
-- payment_links: pros see and manage their own. The public pay page and
-- the Stripe webhook use the server (service role) and go by the token.

create table if not exists public.payment_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (char_length(token) >= 22),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null default '' check (char_length(client_name) <= 100),
  amount_cents integer not null check (amount_cents between 100 and 1000000),
  description text not null check (char_length(description) between 1 and 120),
  status text not null default 'open' check (status in ('open', 'paid', 'cancelled')),
  checkout_session_id text,
  payment_intent_id text,
  payer_email text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payment_links_stylist_idx on public.payment_links (stylist_id, created_at desc);

alter table public.payment_links enable row level security;
drop policy if exists "payment links: own read" on public.payment_links;
create policy "payment links: own read" on public.payment_links
  for select to authenticated using (stylist_id = (select auth.uid()));
drop policy if exists "payment links: own add" on public.payment_links;
create policy "payment links: own add" on public.payment_links
  for insert to authenticated with check (stylist_id = (select auth.uid()) and status = 'open');
drop policy if exists "payment links: own cancel" on public.payment_links;
create policy "payment links: own cancel" on public.payment_links
  for update to authenticated using (stylist_id = (select auth.uid()) and status = 'open') with check (stylist_id = (select auth.uid()) and status = 'cancelled');
grant select, insert on public.payment_links to authenticated;
grant update (status) on public.payment_links to authenticated;

-- A payment made through a link shows in Money as "Paid by link".
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.payments'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%method%'
  loop
    execute format('alter table public.payments drop constraint %I', c);
  end loop;
end;
$$;
alter table public.payments add constraint payments_method_check
  check (method in ('cash', 'zelle', 'cashapp', 'venmo', 'card', 'check', 'other', 'link'));

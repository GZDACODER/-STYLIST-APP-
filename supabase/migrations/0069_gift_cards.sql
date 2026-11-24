-- Step 65: gift cards. Clients buy them on the pro's booking page (paid to
-- the pro's own Stripe account); the pro redeems them by code. Off until the
-- pro turns them on. Writes go through the server only.

alter table public.stylists add column if not exists gift_cards_on boolean not null default false;
grant update (gift_cards_on) on public.stylists to authenticated;

create table if not exists public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  code text not null unique check (code ~ '^GIFT-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$'),
  amount_cents integer not null check (amount_cents between 1000 and 100000),
  balance_cents integer not null check (balance_cents >= 0),
  buyer_name text not null check (char_length(buyer_name) between 1 and 100),
  buyer_email text not null check (char_length(buyer_email) <= 200),
  recipient_name text not null check (char_length(recipient_name) between 1 and 100),
  recipient_email text check (recipient_email is null or char_length(recipient_email) <= 200),
  message text check (message is null or char_length(message) <= 300),
  status text not null default 'pending' check (status in ('pending', 'active', 'used', 'void')),
  checkout_session_id text unique,
  payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (balance_cents <= amount_cents)
);
create index if not exists gift_cards_stylist_idx on public.gift_cards (stylist_id, created_at desc);
alter table public.gift_cards enable row level security;
revoke all on public.gift_cards from anon, authenticated;
grant select on public.gift_cards to authenticated;
drop policy if exists "Pros see their gift cards" on public.gift_cards;
create policy "Pros see their gift cards" on public.gift_cards for select to authenticated using ((select auth.uid()) = stylist_id);

create table if not exists public.gift_redemptions (
  id uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references public.gift_cards (id) on delete cascade,
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  note text check (note is null or char_length(note) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists gift_redemptions_card_idx on public.gift_redemptions (gift_card_id, created_at desc);
alter table public.gift_redemptions enable row level security;
revoke all on public.gift_redemptions from anon, authenticated;
grant select on public.gift_redemptions to authenticated;
drop policy if exists "Pros see their redemptions" on public.gift_redemptions;
create policy "Pros see their redemptions" on public.gift_redemptions for select to authenticated using ((select auth.uid()) = stylist_id);

-- Uses some or all of a card's balance, in one step (so it can't be spent
-- twice). Returns the new balance; errors: not_found, not_active, too_much.
create or replace function public.redeem_gift_card(p_stylist_id uuid, p_code text, p_amount integer, p_note text)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  g public.gift_cards;
begin
  select * into g from public.gift_cards
  where stylist_id = p_stylist_id and code = upper(trim(p_code))
  for update;
  if g.id is null then raise exception 'not_found'; end if;
  if g.status <> 'active' then raise exception 'not_active'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > g.balance_cents then raise exception 'too_much'; end if;
  update public.gift_cards
    set balance_cents = balance_cents - p_amount,
        status = case when balance_cents - p_amount = 0 then 'used' else 'active' end
  where id = g.id;
  insert into public.gift_redemptions (gift_card_id, stylist_id, amount_cents, note)
  values (g.id, p_stylist_id, p_amount, nullif(left(trim(coalesce(p_note, '')), 200), ''));
  return g.balance_cents - p_amount;
end;
$$;
revoke all on function public.redeem_gift_card(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.redeem_gift_card(uuid, text, integer, text) to service_role;

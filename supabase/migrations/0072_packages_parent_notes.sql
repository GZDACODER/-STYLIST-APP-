-- Step 68: template update 3 (tutors). Packages: a bundle of prepaid
-- sessions sold to a client; each session that goes ahead uses one (oldest
-- package first; no-shows don't). Parent notes: a parent or guardian on the
-- client card, and a note after each session emailed to them. Template
-- features (modules.packages, modules.parentNotes): on for tutors,
-- switchable for anyone.

alter table public.clients add column if not exists guardian_name text check (guardian_name is null or char_length(guardian_name) <= 100);
alter table public.clients add column if not exists guardian_email text check (guardian_email is null or char_length(guardian_email) <= 254);

alter table public.bookings add column if not exists parent_note text check (parent_note is null or char_length(parent_note) <= 1500);
alter table public.bookings add column if not exists parent_note_sent_at timestamptz;
grant update (parent_note) on public.bookings to authenticated;

create table if not exists public.client_packages (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  client_name text not null,
  name text not null check (char_length(name) between 1 and 100),
  service_id uuid references public.services (id) on delete set null,
  sessions_total smallint not null check (sessions_total between 1 and 200),
  sessions_used smallint not null default 0 check (sessions_used >= 0),
  price_cents integer not null default 0 check (price_cents between 0 and 10000000),
  paid_method text check (paid_method is null or paid_method in ('cash', 'zelle', 'cashapp', 'venmo', 'card', 'check', 'other')),
  purchased_on date not null,
  expires_on date,
  status text not null default 'active' check (status in ('active', 'used_up', 'void')),
  note text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now(),
  check (sessions_used <= sessions_total)
);
create index if not exists client_packages_client_idx on public.client_packages (stylist_id, client_id, status);
alter table public.client_packages enable row level security;
revoke all on public.client_packages from anon;
grant select, insert, update on public.client_packages to authenticated;
drop policy if exists "Pros manage their packages" on public.client_packages;
create policy "Pros manage their packages" on public.client_packages for all to authenticated
  using ((select auth.uid()) = stylist_id) with check ((select auth.uid()) = stylist_id);

create table if not exists public.package_uses (
  id uuid primary key default gen_random_uuid(),
  client_package_id uuid not null references public.client_packages (id) on delete cascade,
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.package_uses enable row level security;
revoke all on public.package_uses from anon, authenticated;
grant select on public.package_uses to authenticated;
drop policy if exists "Pros see their package uses" on public.package_uses;
create policy "Pros see their package uses" on public.package_uses for select to authenticated using ((select auth.uid()) = stylist_id);

-- The every-minute job: sessions that have started (and weren't no-shows)
-- use one session from the client's oldest matching active package.
-- Returns how many sessions were used.
create or replace function public.package_apply_due()
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  b record;
  cp public.client_packages;
  n integer := 0;
begin
  for b in
    select bk.id, bk.stylist_id, bk.client_id, bk.service_id, bk.booking_date
    from public.bookings bk
    join public.stylists s on s.id = bk.stylist_id
    where bk.status = 'confirmed'
      and coalesce(bk.outcome, '') not in ('no_show', 'replaced')
      and bk.client_id is not null
      and bk.booking_date >= current_date - 30
      and bk.booking_date + bk.start_time <= (now() at time zone s.timezone)
      and not exists (select 1 from public.package_uses u where u.booking_id = bk.id)
      and exists (select 1 from public.client_packages p where p.client_id = bk.client_id and p.status = 'active')
    order by bk.booking_date, bk.start_time
    limit 200
  loop
    select * into cp from public.client_packages p
    where p.stylist_id = b.stylist_id and p.client_id = b.client_id and p.status = 'active'
      and p.sessions_used < p.sessions_total
      and (p.service_id is null or p.service_id = b.service_id)
      and p.purchased_on <= b.booking_date
      and (p.expires_on is null or p.expires_on >= b.booking_date)
    order by p.purchased_on, p.created_at
    limit 1
    for update;
    if cp.id is null then continue; end if;
    insert into public.package_uses (client_package_id, booking_id, stylist_id) values (cp.id, b.id, b.stylist_id)
    on conflict (booking_id) do nothing;
    if found then
      update public.client_packages
        set sessions_used = sessions_used + 1,
            status = case when sessions_used + 1 >= sessions_total then 'used_up' else 'active' end
      where id = cp.id;
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;
revoke all on function public.package_apply_due() from public, anon, authenticated;
grant execute on function public.package_apply_due() to service_role;

-- A no-show or cancellation after a session was counted gives it back.
create or replace function public.package_refund_use()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.package_uses;
begin
  if (new.status = 'cancelled' or coalesce(new.outcome, '') in ('no_show', 'replaced'))
     and not (old.status = 'cancelled' or coalesce(old.outcome, '') in ('no_show', 'replaced')) then
    delete from public.package_uses where booking_id = new.id returning * into u;
    if u.id is not null then
      update public.client_packages
        set sessions_used = greatest(0, sessions_used - 1),
            status = case when status = 'used_up' then 'active' else status end
      where id = u.client_package_id;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_package_refund on public.bookings;
create trigger bookings_package_refund after update of status, outcome on public.bookings
  for each row execute function public.package_refund_use();

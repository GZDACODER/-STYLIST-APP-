-- Step 3: each stylist's client list.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.

-- ============ CLIENTS ============
-- status: 'regular' (gets regulars-first booking), 'new', or 'blocked' (can't book).
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  phone text check (phone is null or char_length(phone) <= 30),
  email text check (email is null or char_length(email) <= 254),
  notes text check (notes is null or char_length(notes) <= 1000),
  status text not null default 'new' check (status in ('regular', 'new', 'blocked')),
  created_at timestamptz not null default now()
);

create index if not exists clients_stylist_id_idx on public.clients (stylist_id);

alter table public.clients enable row level security;

-- A stylist can only see and change their own clients.
drop policy if exists "Stylists can view own clients" on public.clients;
create policy "Stylists can view own clients"
  on public.clients for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can add own clients" on public.clients;
create policy "Stylists can add own clients"
  on public.clients for insert
  to authenticated
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can update own clients" on public.clients;
create policy "Stylists can update own clients"
  on public.clients for update
  to authenticated
  using ((select auth.uid()) = stylist_id)
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can delete own clients" on public.clients;
create policy "Stylists can delete own clients"
  on public.clients for delete
  to authenticated
  using ((select auth.uid()) = stylist_id);

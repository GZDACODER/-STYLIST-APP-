-- Step 1: stylist profiles and their services.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.

-- ============ STYLISTS ============
-- One row per stylist. "id" is the same id as their login account.
create table if not exists public.stylists (
  id uuid primary key references auth.users (id) on delete cascade,
  business_name text not null,
  created_at timestamptz not null default now()
);

alter table public.stylists enable row level security;

-- A stylist can see and edit only their own profile.
drop policy if exists "Stylists can view own profile" on public.stylists;
create policy "Stylists can view own profile"
  on public.stylists for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Stylists can update own profile" on public.stylists;
create policy "Stylists can update own profile"
  on public.stylists for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- When someone signs up, automatically create their stylist profile
-- using the business name they typed on the sign-up form.
create or replace function public.handle_new_stylist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stylists (id, business_name)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'business_name'), ''), 'My salon')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_stylist();

-- ============ SERVICES ============
-- What a stylist offers, e.g. "Women's cut", $45.00, 60 minutes.
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  price_cents integer not null check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  created_at timestamptz not null default now()
);

create index if not exists services_stylist_id_idx on public.services (stylist_id);

alter table public.services enable row level security;

-- For now a stylist can only see and change their own services.
-- (Later, when clients can book, we'll add a rule letting them view services.)
drop policy if exists "Stylists can view own services" on public.services;
create policy "Stylists can view own services"
  on public.services for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can add own services" on public.services;
create policy "Stylists can add own services"
  on public.services for insert
  to authenticated
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can update own services" on public.services;
create policy "Stylists can update own services"
  on public.services for update
  to authenticated
  using ((select auth.uid()) = stylist_id)
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can delete own services" on public.services;
create policy "Stylists can delete own services"
  on public.services for delete
  to authenticated
  using ((select auth.uid()) = stylist_id);

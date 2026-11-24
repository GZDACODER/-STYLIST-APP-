-- Step 67: template update 2 (tattoo). Projects group the sessions of one
-- multi-session piece (a sleeve, a back piece); healing check-in emails go
-- out on day 1, 3 and 14 after a session. Both are template features
-- (lib/templates: modules.projects, modules.healing): on for tattoo
-- artists, and any pro can switch them on or off in Settings > Business type.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  client_id uuid references public.clients (id) on delete set null,
  client_name text not null check (char_length(client_name) between 1 and 100),
  title text not null check (char_length(title) between 1 and 100),
  placement text check (placement is null or char_length(placement) <= 100),
  sessions_planned smallint check (sessions_planned is null or sessions_planned between 1 and 50),
  status text not null default 'in_progress' check (status in ('planning', 'in_progress', 'healing', 'done')),
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_stylist_idx on public.projects (stylist_id, status, updated_at desc);
alter table public.projects enable row level security;
revoke all on public.projects from anon;
grant select, insert, update, delete on public.projects to authenticated;
drop policy if exists "Pros manage their projects" on public.projects;
create policy "Pros manage their projects" on public.projects for all to authenticated
  using ((select auth.uid()) = stylist_id) with check ((select auth.uid()) = stylist_id);

alter table public.bookings add column if not exists project_id uuid references public.projects (id) on delete set null;
create index if not exists bookings_project_idx on public.bookings (project_id) where project_id is not null;
grant update (project_id) on public.bookings to authenticated;

-- Healing check-ins: the last day sent (0 = none yet; 1, 3 or 14).
alter table public.bookings add column if not exists healing_sent smallint not null default 0;

-- Which check-in is due now: the latest of day 1, 3 or 14 that's reached and
-- not sent (up to 2 days late, so a missed run still catches up), from 10 AM
-- in the pro's time zone. Only for visits that went ahead.
create or replace function public.healing_due()
returns table (booking_id uuid, stylist_id uuid, day smallint, client_email text, client_name text, service_name text,
               business_name text, slug text, cancel_token text, aftercare text, project_title text)
language sql
stable
security definer
set search_path = ''
as $$
  with b as (
    select bk.*, s.business_name, s.slug, s.timezone,
           ((now() at time zone s.timezone)::date - bk.booking_date) as d,
           extract(hour from (now() at time zone s.timezone)) as hr
    from public.bookings bk
    join public.stylists s on s.id = bk.stylist_id
    where bk.status = 'confirmed'
      and coalesce(bk.outcome, '') not in ('no_show', 'replaced')
      and coalesce(bk.client_email, '') like '%@%'
      and bk.booking_date between current_date - 17 and current_date
      and coalesce((s.modules ->> 'healing')::boolean, s.business_type = 'tattoo')
  )
  select b.id, b.stylist_id, x.day::smallint, b.client_email, b.client_name, b.service_name, b.business_name, b.slug,
         b.cancel_token, coalesce(sv.aftercare, ''), p.title
  from b
  cross join lateral (
    select max(day) as day from unnest(array[1, 3, 14]) as day
    where day <= b.d and day > b.healing_sent and b.d - day <= 2
  ) x
  left join public.services sv on sv.id = b.service_id
  left join public.projects p on p.id = b.project_id
  where x.day is not null and b.hr >= 10
  order by b.booking_date
  limit 50;
$$;
revoke all on function public.healing_due() from public, anon, authenticated;
grant execute on function public.healing_due() to service_role;

create or replace function public.healing_mark(p_booking_id uuid, p_day integer)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.bookings set healing_sent = greatest(healing_sent, p_day) where id = p_booking_id;
$$;
revoke all on function public.healing_mark(uuid, integer) from public, anon, authenticated;
grant execute on function public.healing_mark(uuid, integer) to service_role;

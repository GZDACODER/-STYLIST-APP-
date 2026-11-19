-- Step 42: getting-started emails for new pros.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0020_welcome_email.sql first. Running this again later is safe.
--
-- After the welcome email, up to four short emails during the free trial,
-- sent by the every-minute check, each one only if it still applies:
--   day 2  'finish_setup'   services or working hours still missing
--   day 4  'first_booking'  set up, but no bookings yet: how to share the link
--   day 6  'deposits'       Stripe not connected yet
--   day 9  'features'       Regulars First, waitlist, standing visits, Assistant
-- Never more than one a day, and they stop when the trial ends or a plan starts.
create table if not exists public.onboarding_emails (
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  kind text not null check (kind in ('finish_setup', 'first_booking', 'deposits', 'features')),
  sent_at timestamptz not null default now(),
  primary key (stylist_id, kind)
);

alter table public.onboarding_emails enable row level security;
revoke all on public.onboarding_emails from anon, authenticated;

create or replace function public.onboarding_due_emails()
returns table (
  stylist_id uuid,
  kind text,
  business_name text,
  first_name text,
  slug text,
  trial_ends_at timestamptz,
  has_services boolean,
  has_hours boolean,
  has_openings boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with pros as (
    select p.stylist_id, s.business_name, s.first_name, s.slug, p.trial_ends_at, p.welcome_sent_at,
      exists (select 1 from public.services x where x.stylist_id = p.stylist_id) as has_services,
      exists (select 1 from public.working_hours x where x.stylist_id = p.stylist_id) as has_hours,
      exists (select 1 from public.openings x where x.stylist_id = p.stylist_id and x.opening_date >= current_date) as has_openings,
      exists (select 1 from public.bookings x where x.stylist_id = p.stylist_id) as has_bookings,
      coalesce(s.stripe_charges_enabled, false) as has_stripe
    from public.stylist_plans p
    join public.stylists s on s.id = p.stylist_id
    where p.welcome_sent_at is not null
      and p.welcome_sent_at > now() - interval '14 days'
      and p.trial_ends_at > now()
      and coalesce(p.stripe_status, '') not in ('active', 'trialing', 'past_due')
      and not exists (
        select 1 from public.onboarding_emails o
        where o.stylist_id = p.stylist_id and o.sent_at > now() - interval '20 hours'
      )
  ),
  candidates as (
    select pr.*, k.kind, k.ord from pros pr
    cross join lateral (values
      ('finish_setup', 1, interval '2 days', not (pr.has_services and pr.has_hours)),
      ('first_booking', 2, interval '4 days', pr.has_services and pr.has_hours and not pr.has_bookings),
      ('deposits', 3, interval '6 days', not pr.has_stripe),
      ('features', 4, interval '9 days', true)
    ) as k(kind, ord, after, applies)
    where k.applies
      and pr.welcome_sent_at <= now() - k.after
      and not exists (
        select 1 from public.onboarding_emails o where o.stylist_id = pr.stylist_id and o.kind = k.kind
      )
  )
  -- One per pro at a time: the earliest one due.
  select distinct on (c.stylist_id)
    c.stylist_id, c.kind, c.business_name, c.first_name, c.slug, c.trial_ends_at,
    c.has_services, c.has_hours, c.has_openings
  from candidates c
  order by c.stylist_id, c.ord
  limit 100;
$$;

create or replace function public.onboarding_mark_sent(p_stylist_id uuid, p_kind text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.onboarding_emails (stylist_id, kind) values (p_stylist_id, p_kind)
  on conflict (stylist_id, kind) do nothing;
$$;

revoke execute on function public.onboarding_due_emails() from public, anon, authenticated;
revoke execute on function public.onboarding_mark_sent(uuid, text) from public, anon, authenticated;
grant execute on function public.onboarding_due_emails() to service_role;
grant execute on function public.onboarding_mark_sent(uuid, text) to service_role;

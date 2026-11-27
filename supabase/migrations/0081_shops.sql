-- Shop accounts: one owner, several chairs. Each chair is its own Clientele
-- account (own login, booking page, calendar, clients and Stripe payouts);
-- the shop links them, the owner sees all chairs on one page (shop_overview)
-- and pays for them on one subscription: All-in for the owner's own chair
-- plus an "Extra chair" item for each other chair (lib/plans.js). While the
-- owner's plan is on, every active chair has every feature (shop_covers).
-- Writes go through the app's server actions (admin client), so the
-- tables only have read policies.

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.stylists (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);

create table if not exists public.shop_chairs (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  stylist_id uuid references public.stylists (id) on delete cascade,
  invite_name text check (invite_name is null or char_length(invite_name) <= 100),
  invite_email text check (invite_email is null or char_length(invite_email) <= 200),
  invite_token text not null unique check (char_length(invite_token) >= 22),
  status text not null default 'invited' check (status in ('invited', 'active', 'removed')),
  created_at timestamptz not null default now(),
  joined_at timestamptz,
  removed_at timestamptz,
  check (status = 'invited' or stylist_id is not null)
);

-- A pro is a chair in one shop at a time.
create unique index if not exists shop_chairs_one_shop on public.shop_chairs (stylist_id) where status = 'active';
create index if not exists shop_chairs_shop on public.shop_chairs (shop_id, status);
create index if not exists shop_chairs_invite_email on public.shop_chairs (lower(invite_email)) where status = 'invited';

alter table public.shops enable row level security;
alter table public.shop_chairs enable row level security;
revoke all on public.shops, public.shop_chairs from anon;
revoke insert, update, delete on public.shops, public.shop_chairs from authenticated;

-- (Helpers that skip row security, so the two policies don't loop.)
create or replace function public.my_owned_shop_id()
returns uuid language sql stable security definer set search_path to '' as $$
  select id from public.shops where owner_id = (select auth.uid());
$$;
create or replace function public.my_chair_shop_id()
returns uuid language sql stable security definer set search_path to '' as $$
  select shop_id from public.shop_chairs where stylist_id = (select auth.uid()) and status = 'active';
$$;
revoke all on function public.my_owned_shop_id(), public.my_chair_shop_id() from public, anon;
grant execute on function public.my_owned_shop_id(), public.my_chair_shop_id() to authenticated;

drop policy if exists "Owners and chairs can view their shop" on public.shops;
create policy "Owners and chairs can view their shop" on public.shops for select to authenticated
  using (owner_id = (select auth.uid()) or id = (select public.my_chair_shop_id()));

drop policy if exists "Owners see their chairs; chairs see their own row" on public.shop_chairs;
create policy "Owners see their chairs; chairs see their own row" on public.shop_chairs for select to authenticated
  using (stylist_id = (select auth.uid()) or shop_id = (select public.my_owned_shop_id()));

-- How many extra chairs the owner's subscription pays for (set from Stripe).
alter table public.stylist_plans add column if not exists shop_chairs integer not null default 0;
alter table public.stylist_plans drop constraint if exists stylist_plans_shop_chairs_check;
alter table public.stylist_plans add constraint stylist_plans_shop_chairs_check check (shop_chairs between 0 and 50);

-- True when this pro is an active chair in a shop whose owner's plan is on.
create or replace function public.shop_covers(p_stylist_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.shop_chairs c
    join public.shops s on s.id = c.shop_id
    join public.stylist_plans p on p.stylist_id = s.owner_id
    where c.stylist_id = p_stylist_id
      and c.status = 'active'
      and s.owner_id <> p_stylist_id
      and (
        p.comped
        or (p.trial_ends_at is not null and p.trial_ends_at > now())
        or p.base_active or p.regulars_active or p.waitlist_active
      )
  );
$$;
revoke all on function public.shop_covers(uuid) from public, anon;
grant execute on function public.shop_covers(uuid) to authenticated, service_role;

-- The plan gate everywhere: now also on for a chair the shop pays for.
create or replace function public.stylist_has_feature(p_stylist_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select coalesce(
    (
      select
        p.comped
        or (p.trial_ends_at is not null and p.trial_ends_at > now())
        or p.base_active
        or p.regulars_active
        or p.waitlist_active
      from public.stylist_plans p
      where p.stylist_id = p_stylist_id
    ),
    false
  ) or public.shop_covers(p_stylist_id);
$$;

-- A chair the shop pays for gets no "your trial is ending" email.
create or replace function public.plan_due_reminders()
returns table(stylist_id uuid, kind text, business_name text, first_name text, trial_ends_at timestamptz, slug text)
language sql
stable
security definer
set search_path to ''
as $$
  select p.stylist_id, 'welcome', s.business_name, s.first_name, p.trial_ends_at, s.slug
  from public.stylist_plans p
  join public.stylists s on s.id = p.stylist_id
  join auth.users u on u.id = p.stylist_id
  where p.welcome_sent_at is null
    and u.email_confirmed_at is not null
  union all
  select p.stylist_id, 'trial_ending', s.business_name, s.first_name, p.trial_ends_at, s.slug
  from public.stylist_plans p
  join public.stylists s on s.id = p.stylist_id
  where not p.comped
    and p.trial_reminder_sent_at is null
    and p.trial_ends_at > now()
    and p.trial_ends_at <= now() + interval '3 days'
    and coalesce(p.stripe_status, '') not in ('active', 'trialing', 'past_due')
    and not public.shop_covers(p.stylist_id)
  union all
  select p.stylist_id, 'paused', s.business_name, s.first_name, p.trial_ends_at, s.slug
  from public.stylist_plans p
  join public.stylists s on s.id = p.stylist_id
  where not p.comped
    and p.paused_notice_sent_at is null
    and not public.stylist_has_feature(p.stylist_id, 'base')
    and (p.trial_ends_at is not null or p.stripe_subscription_id is not null)
  limit 100;
$$;

-- The owner's one page: every chair (the owner's own first) with today's
-- appointments, the next 7 days, money this month and payouts status, plus
-- invites still waiting. null for anyone who doesn't own a shop.
create or replace function public.shop_overview()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  with shop as (
    select * from public.shops where owner_id = (select auth.uid())
  ),
  members as (
    select s.owner_id as stylist_id, null::uuid as chair_id, true as is_owner, s.created_at as joined_at from shop s
    union all
    select c.stylist_id, c.id, false, c.joined_at
    from public.shop_chairs c join shop s on s.id = c.shop_id
    where c.status = 'active' and c.stylist_id <> s.owner_id
  ),
  chair_rows as (
    select
      m.*,
      st.business_name, st.first_name, st.slug, st.cover_photo_url,
      coalesce(st.stripe_charges_enabled, false) as payouts,
      (now() at time zone coalesce(st.timezone, 'America/Chicago'))::date as today
    from members m join public.stylists st on st.id = m.stylist_id
  )
  select case when not exists (select 1 from shop) then null else jsonb_build_object(
    'id', (select id from shop),
    'name', (select name from shop),
    'chairs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'stylist_id', r.stylist_id,
        'chair_id', r.chair_id,
        'is_owner', r.is_owner,
        'business_name', r.business_name,
        'first_name', r.first_name,
        'slug', r.slug,
        'photo', r.cover_photo_url,
        'payouts', r.payouts,
        'joined_at', r.joined_at,
        'today', (
          select coalesce(jsonb_agg(jsonb_build_object(
            'time', b.start_time, 'service', b.service_name,
            'client', split_part(coalesce(b.client_name, ''), ' ', 1)
          ) order by b.start_time), '[]'::jsonb)
          from public.bookings b
          where b.stylist_id = r.stylist_id and b.status = 'confirmed' and b.booking_date = r.today
        ),
        'week', (
          select count(*) from public.bookings b
          where b.stylist_id = r.stylist_id and b.status = 'confirmed'
            and b.booking_date >= r.today and b.booking_date < r.today + 7
        ),
        'month_cents', (
          select coalesce(sum(x.amount_cents), 0) from public.payments x
          where x.stylist_id = r.stylist_id and x.paid_on >= date_trunc('month', r.today)::date
        ) + (
          select coalesce(sum(b.deposit_cents), 0) from public.bookings b
          where b.stylist_id = r.stylist_id and b.deposit_status = 'paid'
            and b.deposit_paid_at >= date_trunc('month', r.today)
        )
      ) order by r.is_owner desc, r.joined_at)
      from chair_rows r
    ), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'name', c.invite_name, 'email', c.invite_email, 'token', c.invite_token, 'created_at', c.created_at
      ) order by c.created_at desc)
      from public.shop_chairs c join shop s on s.id = c.shop_id
      where c.status = 'invited'
    ), '[]'::jsonb)
  ) end;
$$;
revoke all on function public.shop_overview() from public, anon;
grant execute on function public.shop_overview() to authenticated;

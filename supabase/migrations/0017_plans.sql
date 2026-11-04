-- Step 13 (billing, part 1): each stylist's plan and add-on switches.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Running this again later is safe.
--
-- No billing yet: every stylist who exists today is marked free, and new
-- stylists get a 14-day trial with everything on. So nothing changes for
-- anyone yet. Part 2 (Stripe) is what turns plans on and off.
--
-- What each part of the plan unlocks:
--   base     - the $15/mo plan: booking page, services, hours, openings,
--              calendar, clients, deposits (and everything not listed below)
--   regulars - Regulars First add-on: "Regulars only" openings,
--              Regulars-only mode, invite links (needs base)
--   waitlist - Waitlist add-on: the waitlist (needs base)
-- A free (comped) account or one still in its trial has everything.
--
-- When an add-on is paused, already-booked appointments and existing
-- openings are never touched. Only switching the feature on, or making
-- something new with it, is refused.

-- ============ PLANS ============
create table if not exists public.stylist_plans (
  stylist_id uuid primary key references public.stylists (id) on delete cascade,
  -- Never billed (you, and the test accounts that exist today).
  comped boolean not null default false,
  -- Everything is on until then. Empty = no trial.
  trial_ends_at timestamptz,
  -- Set by Stripe (part 2): what the stylist is paying for right now.
  base_active boolean not null default false,
  regulars_active boolean not null default false,
  waitlist_active boolean not null default false,
  billing_interval text check (billing_interval in ('month', 'year')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  stripe_status text,
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.stylist_plans enable row level security;

-- A stylist can see their own plan. Nobody can change it from the app:
-- only Clientele's server (with the secret key) and Stripe's webhook can.
drop policy if exists "Stylists can view own plan" on public.stylist_plans;
create policy "Stylists can view own plan"
  on public.stylist_plans for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

revoke insert, update, delete on public.stylist_plans from anon, authenticated;
grant select on public.stylist_plans to authenticated;

-- Everyone who's a stylist today: free.
insert into public.stylist_plans (stylist_id, comped)
select id, true from public.stylists
on conflict (stylist_id) do nothing;

-- New stylists: a 14-day trial with everything on.
create or replace function public.plan_start_trial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.stylist_plans (stylist_id, trial_ends_at)
  values (new.id, now() + interval '14 days')
  on conflict (stylist_id) do nothing;
  return new;
end;
$$;

drop trigger if exists stylists_start_trial on public.stylists;
create trigger stylists_start_trial
  after insert on public.stylists
  for each row execute function public.plan_start_trial();

-- ============ "DOES THIS STYLIST HAVE ...?" ============
-- p_feature: 'base', 'regulars' or 'waitlist'.
create or replace function public.stylist_has_feature(p_stylist_id uuid, p_feature text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select
        p.comped
        or (p.trial_ends_at is not null and p.trial_ends_at > now())
        or (
          p.base_active
          and case p_feature
            when 'base' then true
            when 'regulars' then p.regulars_active
            when 'waitlist' then p.waitlist_active
            else false
          end
        )
      from public.stylist_plans p
      where p.stylist_id = p_stylist_id
    ),
    false
  );
$$;

-- ============ THE DATABASE REFUSES PAUSED FEATURES ============
-- Turning on Regulars-only mode or the waitlist.
create or replace function public.plan_check_stylist_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.regulars_only and not old.regulars_only
     and not public.stylist_has_feature(new.id, 'regulars') then
    raise exception 'plan_regulars_paused';
  end if;
  if new.waitlist_enabled and not old.waitlist_enabled
     and not public.stylist_has_feature(new.id, 'waitlist') then
    raise exception 'plan_waitlist_paused';
  end if;
  return new;
end;
$$;

drop trigger if exists stylists_check_plan on public.stylists;
create trigger stylists_check_plan
  before update of regulars_only, waitlist_enabled on public.stylists
  for each row execute function public.plan_check_stylist_settings();

-- New "Regulars only" openings (or switching one to Regulars only).
create or replace function public.plan_check_opening()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.visibility = 'regulars'
     and (tg_op = 'INSERT' or old.visibility is distinct from 'regulars')
     and not public.stylist_has_feature(new.stylist_id, 'regulars') then
    raise exception 'plan_regulars_paused';
  end if;
  return new;
end;
$$;

drop trigger if exists openings_check_plan on public.openings;
create trigger openings_check_plan
  before insert or update of visibility on public.openings
  for each row execute function public.plan_check_opening();

-- New invite links.
create or replace function public.plan_check_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.stylist_has_feature(new.stylist_id, 'regulars') then
    raise exception 'plan_regulars_paused';
  end if;
  return new;
end;
$$;

drop trigger if exists client_invites_check_plan on public.client_invites;
create trigger client_invites_check_plan
  before insert on public.client_invites
  for each row execute function public.plan_check_invite();

-- New people joining the waitlist.
create or replace function public.plan_check_waitlist_entry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.stylist_has_feature(new.stylist_id, 'waitlist') then
    raise exception 'plan_waitlist_paused';
  end if;
  return new;
end;
$$;

drop trigger if exists waitlist_entries_check_plan on public.waitlist_entries;
create trigger waitlist_entries_check_plan
  before insert on public.waitlist_entries
  for each row execute function public.plan_check_waitlist_entry();

-- ============ SWITCHING PAUSED ADD-ONS OFF ============
-- When an add-on lapses (trial over, or not paid), switch off Regulars-only
-- mode and the waitlist, so new clients can book and nobody is emailed about
-- times. Existing bookings, openings and waitlist entries stay as they are.
-- Run every minute by the waitlist check (Clientele's server).
-- p_stylist_id: one stylist, or empty for everyone. Returns how many changed.
create or replace function public.plan_apply_limits(p_stylist_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_regulars integer;
  v_waitlist integer;
begin
  update public.stylists s
  set regulars_only = false
  where s.regulars_only
    and (p_stylist_id is null or s.id = p_stylist_id)
    and not public.stylist_has_feature(s.id, 'regulars');
  get diagnostics v_regulars = row_count;

  update public.stylists s
  set waitlist_enabled = false
  where s.waitlist_enabled
    and (p_stylist_id is null or s.id = p_stylist_id)
    and not public.stylist_has_feature(s.id, 'waitlist');
  get diagnostics v_waitlist = row_count;

  return v_regulars + v_waitlist;
end;
$$;

-- Only Clientele's own server code may call these.
revoke execute on function public.stylist_has_feature(uuid, text) from public, anon, authenticated;
revoke execute on function public.plan_apply_limits(uuid) from public, anon, authenticated;
revoke execute on function public.plan_start_trial() from public, anon, authenticated;
revoke execute on function public.plan_check_stylist_settings() from public, anon, authenticated;
revoke execute on function public.plan_check_opening() from public, anon, authenticated;
revoke execute on function public.plan_check_invite() from public, anon, authenticated;
revoke execute on function public.plan_check_waitlist_entry() from public, anon, authenticated;
grant execute on function public.plan_apply_limits(uuid) to service_role;
grant execute on function public.stylist_has_feature(uuid, text) to service_role;

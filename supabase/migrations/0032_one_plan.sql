-- Step 27: one plan (All-in) with every feature, plus team members.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0017_plans.sql first. Running this again later is safe.
--
-- Clientele now has one plan, All-in ($25/month or $250/year), with every
-- feature. There are no add-ons any more: a free (founding) account, an
-- account in its 14-day trial, or any account paying for a Clientele plan
-- (All-in, or an older plan someone still pays for) has everything.
-- Team members are extra seats on the same subscription, at half price
-- each; their number is kept here. Free accounts stay free.

-- How many team members the account pays for (set from Stripe).
alter table public.stylist_plans add column if not exists team_members integer not null default 0;
alter table public.stylist_plans drop constraint if exists stylist_plans_team_members_check;
alter table public.stylist_plans add constraint stylist_plans_team_members_check
  check (team_members between 0 and 50);

-- "Does this stylist have ...?" Every feature now comes with any plan, so
-- p_feature ('base', 'regulars', 'waitlist') no longer changes the answer.
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
        or p.base_active
        or p.regulars_active
        or p.waitlist_active
      from public.stylist_plans p
      where p.stylist_id = p_stylist_id
    ),
    false
  );
$$;

-- Anyone already paying for any old plan part has the whole plan from now on.
update public.stylist_plans
set base_active = true, regulars_active = true, waitlist_active = true, updated_at = now()
where (base_active or regulars_active or waitlist_active)
  and not (base_active and regulars_active and waitlist_active);

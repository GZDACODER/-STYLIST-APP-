-- Step 16: a "Welcome to Clientele" email for new stylists.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0019_plan_reminders.sql first. Running this again later is safe.
--
-- Sent once, by the every-minute check, as soon as a new stylist has
-- confirmed their email: their booking link, three first steps and their
-- free trial. Stylists who already exist when this runs don't get one.

alter table public.stylist_plans add column if not exists welcome_sent_at timestamptz;

-- Everyone who's a stylist today: counted as already welcomed. Runs only
-- the first time (when nobody has been welcomed yet).
update public.stylist_plans
set welcome_sent_at = now()
where welcome_sent_at is null
  and not exists (select 1 from public.stylist_plans where welcome_sent_at is not null);

-- Same as step 15, plus 'welcome' and each stylist's booking link (slug).
drop function if exists public.plan_due_reminders();
create function public.plan_due_reminders()
returns table (
  stylist_id uuid,
  kind text,
  business_name text,
  first_name text,
  trial_ends_at timestamptz,
  slug text
)
language sql
stable
security definer
set search_path = ''
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

-- Notes that a reminder was sent. p_kind: 'welcome', 'trial_ending' or 'paused'.
create or replace function public.plan_mark_reminder(p_stylist_id uuid, p_kind text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.stylist_plans
  set welcome_sent_at = case when p_kind = 'welcome' then now() else welcome_sent_at end,
      trial_reminder_sent_at = case when p_kind = 'trial_ending' then now() else trial_reminder_sent_at end,
      paused_notice_sent_at = case when p_kind = 'paused' then now() else paused_notice_sent_at end
  where stylist_id = p_stylist_id;
$$;

revoke execute on function public.plan_due_reminders() from public, anon, authenticated;
revoke execute on function public.plan_mark_reminder(uuid, text) from public, anon, authenticated;
grant execute on function public.plan_due_reminders() to service_role;
grant execute on function public.plan_mark_reminder(uuid, text) to service_role;

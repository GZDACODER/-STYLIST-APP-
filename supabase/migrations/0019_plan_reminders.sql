-- Step 15 (billing, part 4): reminder emails to stylists about their plan.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0017_plans.sql first. Running this again later is safe.
--
-- The every-minute check (Clientele's server) asks plan_due_reminders()
-- who needs an email, sends it, then calls plan_mark_reminder() so nobody
-- gets the same email twice:
--   trial_ending - the free trial ends within 3 days and no plan is chosen
--   paused       - the trial ended with no plan, or the plan stopped
--                  (cancelled or unpaid). Sent again only after they pay
--                  and it stops again.
-- "Your payment didn't go through" is sent straight from the Stripe
-- webhook when a subscription becomes past due.

alter table public.stylist_plans add column if not exists trial_reminder_sent_at timestamptz;
alter table public.stylist_plans add column if not exists paused_notice_sent_at timestamptz;

-- Who needs a reminder right now (at most 100 at a time).
create or replace function public.plan_due_reminders()
returns table (stylist_id uuid, kind text, business_name text, first_name text, trial_ends_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.stylist_id, 'trial_ending', s.business_name, s.first_name, p.trial_ends_at
  from public.stylist_plans p
  join public.stylists s on s.id = p.stylist_id
  where not p.comped
    and p.trial_reminder_sent_at is null
    and p.trial_ends_at > now()
    and p.trial_ends_at <= now() + interval '3 days'
    and coalesce(p.stripe_status, '') not in ('active', 'trialing', 'past_due')
  union all
  select p.stylist_id, 'paused', s.business_name, s.first_name, p.trial_ends_at
  from public.stylist_plans p
  join public.stylists s on s.id = p.stylist_id
  where not p.comped
    and p.paused_notice_sent_at is null
    and not public.stylist_has_feature(p.stylist_id, 'base')
    -- Only after a trial or a plan has actually ended (not a brand-new row).
    and (p.trial_ends_at is not null or p.stripe_subscription_id is not null)
  limit 100;
$$;

-- Notes that a reminder was sent. p_kind: 'trial_ending' or 'paused'.
create or replace function public.plan_mark_reminder(p_stylist_id uuid, p_kind text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.stylist_plans
  set trial_reminder_sent_at = case when p_kind = 'trial_ending' then now() else trial_reminder_sent_at end,
      paused_notice_sent_at = case when p_kind = 'paused' then now() else paused_notice_sent_at end
  where stylist_id = p_stylist_id;
$$;

-- When the plan is on again (they paid), the next pause gets a new email.
create or replace function public.plan_reset_paused_notice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.base_active and not coalesce(old.base_active, false) then
    new.paused_notice_sent_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists stylist_plans_reset_paused_notice on public.stylist_plans;
create trigger stylist_plans_reset_paused_notice
  before update of base_active on public.stylist_plans
  for each row execute function public.plan_reset_paused_notice();

-- Only Clientele's own server code may call these.
revoke execute on function public.plan_due_reminders() from public, anon, authenticated;
revoke execute on function public.plan_mark_reminder(uuid, text) from public, anon, authenticated;
revoke execute on function public.plan_reset_paused_notice() from public, anon, authenticated;
grant execute on function public.plan_due_reminders() to service_role;
grant execute on function public.plan_mark_reminder(uuid, text) to service_role;

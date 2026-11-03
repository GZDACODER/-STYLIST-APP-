-- Step 7 fix: waitlist emails that fail are tried again every 15 minutes for
-- up to a day (instead of giving up after 3 quick tries), and the reason they
-- failed is kept, so the Waitlist tab can show it.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Running it again later is safe.

alter table public.waitlist_offers add column if not exists last_error text;
-- When sending this offer first failed. Retries stop a day later.
alter table public.waitlist_offers add column if not exists first_failed_at timestamptz;

-- Sending failed: keep the reason, and try again in 15 minutes.
drop function if exists public.waitlist_unmark(uuid[]);
create or replace function public.waitlist_unmark(p_offer_ids uuid[], p_error text default null)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.waitlist_offers
  set notified_at = null,
      notify_attempts = notify_attempts + 1,
      first_failed_at = coalesce(first_failed_at, now()),
      available_at = now() + interval '15 minutes',
      last_error = left(p_error, 500)
  where id = any (p_offer_ids) and booking_id is null
$$;

-- Same as step 7, with the new retry rule.
create or replace function public.waitlist_process(p_stylist_id uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stylist_id uuid;
  v_stylists uuid[];
  v_result jsonb;
begin
  select coalesce(array_agg(distinct e.stylist_id), '{}')
  into v_stylists
  from public.waitlist_entries e
  where e.status = 'waiting'
    and (p_stylist_id is null or e.stylist_id = p_stylist_id);

  foreach v_stylist_id in array v_stylists loop
    perform public.waitlist_scan(v_stylist_id);
  end loop;

  with due as (
    select o.id
    from public.waitlist_offers o
    join public.waitlist_entries e on e.id = o.entry_id
    join public.stylists s on s.id = o.stylist_id
    where o.stylist_id = any (v_stylists)
      and s.waitlist_enabled
      and e.status = 'waiting'
      and o.notified_at is null
      and o.booking_id is null
      and o.available_at <= now()
      -- After a failed send: wait the 15 minutes waitlist_unmark set, and
      -- keep trying for up to a day.
      and (o.first_failed_at is null or o.first_failed_at > now() - interval '24 hours')
    for update of o skip locked
  ),
  sent as (
    update public.waitlist_offers o
    set notified_at = now()
    from due
    where o.id = due.id
    returning o.id, o.entry_id, o.claim_token, o.slot_date, o.slot_time, o.end_time, o.wave
  ),
  per_entry as (
    select
      e.id as entry_id,
      jsonb_build_object(
        'entry_id', e.id,
        'name', e.name,
        'email', e.email,
        'phone', e.phone,
        'text_ok', e.text_ok,
        'manage_token', e.manage_token,
        'regular', bool_or(sent.wave = 'regulars'),
        'stylist_id', s.id,
        'business_name', s.business_name,
        'slug', s.slug,
        'timezone', s.timezone,
        'service_name', sv.name,
        'deposit_cents', public.service_deposit_cents(s, sv),
        'offers', jsonb_agg(
          jsonb_build_object(
            'id', sent.id,
            'claim_token', sent.claim_token,
            'slot_date', sent.slot_date,
            'slot_time', sent.slot_time,
            'end_time', sent.end_time
          )
          order by sent.slot_date, sent.slot_time
        )
      ) as info
    from sent
    join public.waitlist_entries e on e.id = sent.entry_id
    join public.stylists s on s.id = e.stylist_id
    join public.services sv on sv.id = e.service_id
    group by e.id, s.id, sv.id
  )
  select coalesce(jsonb_agg(info), '[]'::jsonb) into v_result from per_entry;

  return v_result;
end;
$$;

-- Give offers that already failed a fresh start, so they're sent on the next
-- check. (These are the same offers, not new ones, so nobody is told twice.)
update public.waitlist_offers
set notify_attempts = 0,
    first_failed_at = null,
    available_at = now()
where notified_at is null
  and booking_id is null
  and notify_attempts > 0;

-- Only the app's server may call these.
revoke execute on function public.waitlist_process(uuid) from public, anon, authenticated;
revoke execute on function public.waitlist_unmark(uuid[], text) from public, anon, authenticated;
grant execute on function public.waitlist_process(uuid) to service_role;
grant execute on function public.waitlist_unmark(uuid[], text) to service_role;

-- Step 18: end-of-day wrap-up. At 8 PM (the business's own time) the
-- every-minute check emails the business a list of the day's finished
-- visits, and asks how each one went:
--   completed_paid - completed, paid in full
--   completed_owed - completed, balance still owed
--   no_show        - the client didn't come
--   replaced       - someone else came in their place
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0021_standing_appointments.sql first. Running this again later is safe.
-- Nothing is charged or refunded automatically.

alter table public.bookings add column if not exists outcome text;
alter table public.bookings add column if not exists outcome_at timestamptz;

alter table public.bookings drop constraint if exists bookings_outcome_check;
alter table public.bookings add constraint bookings_outcome_check
  check (outcome is null or outcome in ('completed_paid', 'completed_owed', 'no_show', 'replaced'));

create index if not exists bookings_outcome_idx on public.bookings (stylist_id, booking_date)
  where status = 'confirmed' and outcome is null;

-- The last day the wrap-up email went out.
alter table public.stylists add column if not exists wrapup_sent_on date;

-- A no-show, or a visit someone else took, doesn't count as a visit
-- (for "Regular after N visits" and the visit count on client cards).
create or replace function public.completed_visits(c public.clients)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.bookings b
  join public.stylists s on s.id = b.stylist_id
  where b.client_id = c.id
    and b.status = 'confirmed'
    and coalesce(b.outcome, '') not in ('no_show', 'replaced')
    and b.booking_date + b.end_time <= now() at time zone s.timezone
$$;

-- The business marks how a visit went (or clears it with null). Only
-- confirmed visits that have already started.
create or replace function public.set_visit_outcome(p_booking_id uuid, p_outcome text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_outcome is not null
     and p_outcome not in ('completed_paid', 'completed_owed', 'no_show', 'replaced') then
    raise exception 'invalid_outcome';
  end if;

  update public.bookings b
  set outcome = p_outcome,
      outcome_at = case when p_outcome is null then null else now() end
  from public.stylists s
  where b.id = p_booking_id
    and s.id = b.stylist_id
    and b.stylist_id = auth.uid()
    and b.status = 'confirmed'
    and b.booking_date + b.start_time <= now() at time zone s.timezone;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

-- Who needs the wrap-up email now: it's 8 PM or later where they are,
-- they haven't had it today, and today has finished visits not marked yet.
-- visits: [{ client_name, service_name, start_time, price_cents,
-- deposit_cents, deposit_status }] in time order.
create or replace function public.wrapup_due()
returns table (
  stylist_id uuid,
  business_name text,
  first_name text,
  local_date date,
  visits jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id, s.business_name, s.first_name, (now() at time zone s.timezone)::date,
    (
      select jsonb_agg(
        jsonb_build_object(
          'client_name', b.client_name,
          'service_name', b.service_name,
          'start_time', b.start_time,
          'price_cents', b.price_cents,
          'deposit_cents', b.deposit_cents,
          'deposit_status', b.deposit_status
        )
        order by b.start_time
      )
      from public.bookings b
      where b.stylist_id = s.id
        and b.status = 'confirmed'
        and b.outcome is null
        and b.booking_date = (now() at time zone s.timezone)::date
        and b.booking_date + b.end_time <= now() at time zone s.timezone
    )
  from public.stylists s
  where (now() at time zone s.timezone)::time >= time '20:00'
    and s.wrapup_sent_on is distinct from (now() at time zone s.timezone)::date
    and exists (
      select 1 from public.bookings b
      where b.stylist_id = s.id
        and b.status = 'confirmed'
        and b.outcome is null
        and b.booking_date = (now() at time zone s.timezone)::date
        and b.booking_date + b.end_time <= now() at time zone s.timezone
    )
  limit 100
$$;

-- Notes the wrap-up email went out (or that there was no email to send it to).
create or replace function public.wrapup_mark(p_stylist_id uuid, p_date date)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.stylists set wrapup_sent_on = p_date where id = p_stylist_id
$$;

revoke execute on function public.set_visit_outcome(uuid, text) from public, anon;
grant execute on function public.set_visit_outcome(uuid, text) to authenticated;
revoke execute on function public.wrapup_due() from public, anon, authenticated;
revoke execute on function public.wrapup_mark(uuid, date) from public, anon, authenticated;
grant execute on function public.wrapup_due() to service_role;
grant execute on function public.wrapup_mark(uuid, date) to service_role;

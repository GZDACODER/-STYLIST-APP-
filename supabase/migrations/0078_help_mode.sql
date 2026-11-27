-- Help mode: a pro lets Clientele support into their whole dashboard for a
-- while (Settings → Support → "Let Clientele support help me").
--
-- help_sessions: one row per request. Open while ended_at is null and
--   expires_at is in the future. The pro starts and ends their own; the
--   owner enters through /dashboard/admin/help (server only).
-- log_help_change(): while support is inside (the server sends the session
--   id in the x-clientele-help request header), every change to the pro's
--   main tables is written to support_log, which the pro sees in Settings →
--   Support and on Activity. A header without a matching open session for
--   that pro logs nothing.

create table if not exists public.help_sessions (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  entered_at timestamptz,
  ended_at timestamptz,
  ended_by text check (ended_by in ('pro', 'support', 'expired')),
  constraint help_sessions_window check (expires_at <= created_at + interval '2 hours')
);
create index if not exists help_sessions_stylist_idx on public.help_sessions (stylist_id, created_at desc);

alter table public.help_sessions enable row level security;
drop policy if exists "help: own sessions read" on public.help_sessions;
create policy "help: own sessions read" on public.help_sessions
  for select to authenticated using (stylist_id = (select auth.uid()));
drop policy if exists "help: own sessions start" on public.help_sessions;
create policy "help: own sessions start" on public.help_sessions
  for insert to authenticated with check (stylist_id = (select auth.uid()) and ended_at is null and entered_at is null);
drop policy if exists "help: own sessions end" on public.help_sessions;
create policy "help: own sessions end" on public.help_sessions
  for update to authenticated using (stylist_id = (select auth.uid())) with check (stylist_id = (select auth.uid()));
grant select, insert, update (ended_at, ended_by) on public.help_sessions to authenticated;

create or replace function public.log_help_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_header text;
  v_session uuid;
  v_row jsonb;
  v_stylist uuid;
  v_label text;
  v_what text;
begin
  begin
    v_header := nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-clientele-help';
  exception when others then
    v_header := null;
  end;
  if v_header is null or v_header !~ '^[0-9a-fA-F-]{36}$' then
    return null;
  end if;
  v_session := v_header::uuid;
  v_row := to_jsonb(coalesce(new, old));
  v_stylist := case when tg_table_name = 'stylists' then (v_row ->> 'id')::uuid else (v_row ->> 'stylist_id')::uuid end;
  if v_stylist is null or not exists (
    select 1 from public.help_sessions h
    where h.id = v_session and h.stylist_id = v_stylist and h.ended_at is null and h.expires_at > now()
  ) then
    return null;
  end if;

  v_label := case tg_table_name
    when 'services' then 'service' when 'openings' then 'opening' when 'working_hours' then 'working hours'
    when 'blocked_dates' then 'day off' when 'calendar_events' then 'calendar event' when 'bookings' then 'booking'
    when 'clients' then 'client' when 'stylists' then 'business settings' when 'intake_forms' then 'intake form'
    when 'gift_cards' then 'gift card' when 'client_packages' then 'package' when 'projects' then 'project'
    when 'payments' then 'payment' when 'standing_series' then 'standing appointment'
    when 'stylist_holiday_settings' then 'holiday settings' when 'portfolio_photos' then 'portfolio photo'
    else tg_table_name end;
  v_what := coalesce(v_row ->> 'name', v_row ->> 'client_name', v_row ->> 'title', v_row ->> 'opening_date', v_row ->> 'booking_date', '');

  insert into public.support_log (stylist_id, actor, action, detail)
  values (
    v_stylist,
    'Clientele support (help mode)',
    left(initcap(case tg_op when 'INSERT' then 'added' when 'UPDATE' then 'changed' else 'removed' end) || ' ' || v_label
      || case when v_what <> '' then ': ' || v_what else '' end, 300),
    null
  );
  return null;
exception when others then
  return null; -- logging never blocks the change itself
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['services','openings','working_hours','blocked_dates','calendar_events','bookings','clients',
    'stylists','intake_forms','gift_cards','client_packages','projects','payments','standing_series',
    'stylist_holiday_settings','portfolio_photos']
  loop
    execute format('drop trigger if exists help_log on public.%I', t);
    execute format('create trigger help_log after insert or update or delete on public.%I for each row execute function public.log_help_change()', t);
  end loop;
end;
$$;

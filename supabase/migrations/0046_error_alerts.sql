-- Step 41: error alerts.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Running this again later is safe.
--
-- When something breaks on the site (a page, a payment webhook, the
-- every-minute emails), the app notes it here and emails the owner
-- (ADMIN_EMAILS in Vercel). The same problem is emailed at most once an
-- hour, and no more than 25 alert emails go out in a day. The owner sees the
-- list at /dashboard/admin/errors. Only the server (secret key) can read or
-- write it.
create table if not exists public.error_alerts (
  signature text primary key,
  source text not null,
  message text not null,
  detail text,
  path text,
  count integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_emailed_at timestamptz
);

create index if not exists error_alerts_last_seen_idx on public.error_alerts (last_seen desc);

alter table public.error_alerts enable row level security;
revoke all on public.error_alerts from anon, authenticated;

-- Notes one error. Returns the row's count and whether to email now.
create or replace function public.note_error(
  p_signature text, p_source text, p_message text, p_detail text, p_path text
) returns table (seen integer, send_email boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.error_alerts;
  emailed_today integer;
begin
  insert into public.error_alerts as e (signature, source, message, detail, path)
  values (left(p_signature, 300), left(p_source, 100), left(p_message, 2000), left(p_detail, 6000), left(p_path, 500))
  on conflict (signature) do update
    set count = e.count + 1, last_seen = now(),
        message = excluded.message, detail = coalesce(excluded.detail, e.detail), path = coalesce(excluded.path, e.path)
  returning * into r;

  select count(*) into emailed_today from public.error_alerts
  where last_emailed_at > now() - interval '1 day';

  if (r.last_emailed_at is null or r.last_emailed_at < now() - interval '1 hour') and emailed_today < 25 then
    update public.error_alerts set last_emailed_at = now() where signature = r.signature;
    return query select r.count, true;
  else
    return query select r.count, false;
  end if;
end;
$$;

revoke all on function public.note_error(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.note_error(text, text, text, text, text) to service_role;

-- Old alerts tidy themselves away after 90 days (checked when new ones arrive).
create or replace function public.prune_error_alerts() returns void
language sql security definer set search_path = public as $$
  delete from public.error_alerts where last_seen < now() - interval '90 days';
$$;
revoke all on function public.prune_error_alerts() from public, anon, authenticated;
grant execute on function public.prune_error_alerts() to service_role;

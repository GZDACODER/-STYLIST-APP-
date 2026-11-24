-- Step 64: support access levels. The pro chooses view-only or edit, for
-- 1 hour, 24 hours or 7 days, and can turn it off any time. Everything the
-- Clientele team does under it is logged (support_log) and emailed to the pro.

alter table public.support_access add column if not exists level text not null default 'view';
do $$ begin
  alter table public.support_access add constraint support_access_level_check check (level in ('view', 'edit'));
exception when duplicate_object then null; end $$;
-- Access granted before levels existed allowed changes: keep it that way.
update public.support_access set level = 'edit' where until is not null and until > now() and updated_at < now() - interval '1 minute';

alter table public.support_log add column if not exists level text;

-- May the team view (p_level 'view') or change ('edit') this account now?
create or replace function public.support_allowed(p_stylist_id uuid, p_level text default 'edit')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.support_access
    where stylist_id = p_stylist_id and until > now() and (level = 'edit' or coalesce(p_level, 'edit') = 'view')
  );
$$;
revoke all on function public.support_allowed(uuid, text) from public, anon, authenticated;
grant execute on function public.support_allowed(uuid, text) to service_role;
drop function if exists public.support_allowed(uuid);

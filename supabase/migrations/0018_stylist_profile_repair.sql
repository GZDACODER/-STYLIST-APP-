-- Step 14: make sure every stylist sign-up gets a stylist profile.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0017_plans.sql first. Running this again later is safe.
--
-- Until now the profile was only made when a login was first created. If the
-- email already had a login (for example from confirming with a code on a
-- booking page), a stylist sign-up found that login and no profile was made,
-- so the dashboard said "isn't a stylist account". Now:
--   1. a business name added to an existing login (a repeat sign-up) makes
--      the profile, and
--   2. the dashboard can make it for a logged-in person who has none
--      (create_my_stylist). The 14-day trial starts as usual.

-- Makes a stylist profile for a login, if it doesn't have one yet.
create or replace function public.create_stylist_profile(
  p_user_id uuid,
  p_business_name text,
  p_first_name text default ''
)
returns public.stylists
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(left(trim(coalesce(p_business_name, '')), 100), '');
  v_first text := left(trim(coalesce(p_first_name, '')), 50);
  v_stylist public.stylists;
begin
  select * into v_stylist from public.stylists where id = p_user_id;
  if found then
    return v_stylist;
  end if;
  if v_name is null then
    raise exception 'invalid_business_name';
  end if;

  insert into public.stylists (id, business_name, slug, first_name)
  values (p_user_id, v_name, public.make_stylist_slug(v_name, p_user_id), v_first)
  returning * into v_stylist;
  return v_stylist;
end;
$$;

-- 1. A repeat sign-up adds the business name to an existing login.
create or replace function public.handle_stylist_metadata_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(trim(new.raw_user_meta_data ->> 'business_name'), '');
begin
  if v_name is not null
     and not exists (select 1 from public.stylists where id = new.id) then
    perform public.create_stylist_profile(
      new.id, v_name, coalesce(new.raw_user_meta_data ->> 'first_name', '')
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_metadata_updated on auth.users;
create trigger on_auth_user_metadata_updated
  after update of raw_user_meta_data on auth.users
  for each row execute function public.handle_stylist_metadata_update();

-- 2. The dashboard: make a profile for the logged-in person.
create or replace function public.create_my_stylist(p_business_name text, p_first_name text default '')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stylist public.stylists;
begin
  if auth.uid() is null then
    raise exception 'not_logged_in';
  end if;
  v_stylist := public.create_stylist_profile(auth.uid(), p_business_name, p_first_name);
  return v_stylist.slug;
end;
$$;

revoke execute on function public.create_stylist_profile(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.handle_stylist_metadata_update() from public, anon, authenticated;
revoke execute on function public.create_my_stylist(text, text) from public, anon;
grant execute on function public.create_my_stylist(text, text) to authenticated;

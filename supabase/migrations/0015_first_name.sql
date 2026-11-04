-- Step 11: the stylist's first name, for the dashboard greeting.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Running this again later is safe. Nothing else changes.

-- Optional. Empty = the greeting is just "Good afternoon", with no name.
alter table public.stylists add column if not exists first_name text not null default '';

alter table public.stylists drop constraint if exists stylists_first_name_length;
alter table public.stylists add constraint stylists_first_name_length
  check (char_length(first_name) <= 50);

-- Stylists can change it themselves in Settings.
grant update (first_name) on public.stylists to authenticated;

-- New stylists: also copy the first name they typed on the sign-up form.
-- Otherwise the same as before (clients who verify with an email code also
-- get a login, but only sign-ups with a business name get a stylist profile).
create or replace function public.handle_new_stylist()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := nullif(trim(new.raw_user_meta_data ->> 'business_name'), '');
  v_first_name text := left(coalesce(trim(new.raw_user_meta_data ->> 'first_name'), ''), 50);
begin
  if v_name is null then
    return new;
  end if;

  insert into public.stylists (id, business_name, slug, first_name)
  values (new.id, v_name, public.make_stylist_slug(v_name, new.id), v_first_name);
  return new;
end;
$$;

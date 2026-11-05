-- Step 17: "What kind of business?" (optional, from the sign-up form).
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Running this again later is safe. Nothing else changes.
--
-- Empty = not given. The choices match lib/businessTypes.js.

alter table public.stylists add column if not exists business_type text not null default '';

alter table public.stylists drop constraint if exists stylists_business_type_check;
alter table public.stylists add constraint stylists_business_type_check
  check (business_type in (
    '', 'hair', 'barber', 'nails', 'lashes', 'tattoo', 'trainer', 'tutor',
    'pet_grooming', 'photographer', 'other'
  ));

-- They can change it themselves later.
grant update (business_type) on public.stylists to authenticated;

-- A new profile copies the choice from the sign-up form (it's saved with
-- the login). Unknown values are ignored.
create or replace function public.stylists_copy_business_type()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
begin
  if coalesce(new.business_type, '') = '' then
    select lower(trim(u.raw_user_meta_data ->> 'business_type')) into v_type
    from auth.users u
    where u.id = new.id;
    if v_type in (
      'hair', 'barber', 'nails', 'lashes', 'tattoo', 'trainer', 'tutor',
      'pet_grooming', 'photographer', 'other'
    ) then
      new.business_type := v_type;
    else
      new.business_type := '';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists stylists_copy_business_type on public.stylists;
create trigger stylists_copy_business_type
  before insert on public.stylists
  for each row execute function public.stylists_copy_business_type();

revoke execute on function public.stylists_copy_business_type() from public, anon, authenticated;

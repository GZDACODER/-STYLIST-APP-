-- Step 57: public pro profiles (clientelesuite.com/p/<handle>).
-- Everything is off until the pro turns it on in Settings > Public profile.
-- The page itself is read by the server (secret key) and only shows a
-- profile that is switched on, so no new public read access is granted here.

alter table public.stylists add column if not exists profile_on boolean not null default false;
alter table public.stylists add column if not exists handle text;
alter table public.stylists add column if not exists in_search boolean not null default false;
alter table public.stylists add column if not exists owner_name text;
alter table public.stylists add column if not exists city text;
alter table public.stylists add column if not exists bio text;
alter table public.stylists add column if not exists specialties text;
alter table public.stylists add column if not exists years_in_business smallint;
alter table public.stylists add column if not exists tiktok text;
alter table public.stylists add column if not exists website text;
alter table public.stylists add column if not exists profile_show jsonb not null
  default '{"prices": true, "portfolio": true, "reviews": true, "hours": true, "openings": true}'::jsonb;

do $$ begin
  alter table public.stylists add constraint stylists_handle_format
    check (handle is null or handle ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$');
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.stylists add constraint stylists_profile_lengths check (
    char_length(coalesce(owner_name, '')) <= 80 and char_length(coalesce(city, '')) <= 80
    and char_length(coalesce(bio, '')) <= 1200 and char_length(coalesce(specialties, '')) <= 300
    and char_length(coalesce(tiktok, '')) <= 80 and char_length(coalesce(website, '')) <= 200
    and (years_in_business is null or years_in_business between 0 and 80)
  );
exception when duplicate_object then null; end $$;

create unique index if not exists stylists_handle_key on public.stylists (handle) where handle is not null;
-- For search (phase 3): pros shown in search.
create index if not exists stylists_in_search_idx on public.stylists (business_type, city) where profile_on and in_search;

grant update (profile_on, handle, in_search, owner_name, city, bio, specialties, years_in_business, tiktok, website, profile_show)
  on public.stylists to authenticated;

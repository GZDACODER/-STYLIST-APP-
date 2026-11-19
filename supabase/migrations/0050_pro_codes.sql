-- Step 45: Pro ID codes.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Running this again later is safe.
--
-- Every pro gets a short code clients can type, like CL-7KQ4: "CL-" and four
-- characters from 2-9 and A-Z without 0/O, 1/I/L (nothing that looks alike).
-- Existing pros get one now; new pros get one when their profile is made.
-- Clients use it with their phone number to sign in (step 46), and it's in
-- booking emails.
alter table public.stylists add column if not exists pro_code text;

create or replace function public.make_pro_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  letters constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  candidate text;
begin
  loop
    candidate := 'CL-';
    for i in 1..4 loop
      candidate := candidate || substr(letters, 1 + floor(random() * length(letters))::int, 1);
    end loop;
    exit when not exists (select 1 from public.stylists where pro_code = candidate);
  end loop;
  return candidate;
end;
$$;

update public.stylists set pro_code = public.make_pro_code() where pro_code is null;

create unique index if not exists stylists_pro_code_idx on public.stylists (pro_code);
alter table public.stylists drop constraint if exists stylists_pro_code_format;
alter table public.stylists add constraint stylists_pro_code_format
  check (pro_code ~ '^CL-[2-9A-HJKMNP-Z]{4}$');

create or replace function public.stylists_set_pro_code()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pro_code is null then
    new.pro_code := public.make_pro_code();
  end if;
  return new;
end;
$$;

drop trigger if exists stylists_set_pro_code on public.stylists;
create trigger stylists_set_pro_code
  before insert on public.stylists
  for each row execute function public.stylists_set_pro_code();

alter table public.stylists alter column pro_code set not null;

-- "CL-7kq4", "cl 7KQ4", "7KQ4" -> "CL-7KQ4" (or null if it can't be one).
create or replace function public.clean_pro_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when x ~ '^[2-9A-HJKMNP-Z]{4}$' then 'CL-' || x end
  from (select regexp_replace(regexp_replace(upper(coalesce(p_code, '')), '[^0-9A-Z]', '', 'g'), '^CL', '') as x) t
$$;

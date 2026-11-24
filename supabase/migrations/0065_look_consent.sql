-- Step 61: "My look" photos on the public profile, only with the client's
-- consent. Consent is for one photo: a new photo needs asking again, and a
-- client can take it back any time (the photo comes off the profile).

alter table public.bookings add column if not exists look_consent text;
alter table public.bookings add column if not exists look_consent_at timestamptz;
alter table public.bookings add column if not exists look_consent_asked_at timestamptz;
alter table public.bookings add column if not exists look_on_profile boolean not null default false;
do $$ begin
  alter table public.bookings add constraint bookings_look_consent_check check (look_consent is null or look_consent in ('yes', 'no'));
exception when duplicate_object then null; end $$;
-- Never on the profile without a yes.
do $$ begin
  alter table public.bookings add constraint bookings_look_on_profile_needs_consent check (not look_on_profile or look_consent = 'yes');
exception when duplicate_object then null; end $$;

-- A new or removed photo resets consent; a "no" takes it off the profile.
create or replace function public.bookings_look_consent_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.look_photo_path is distinct from old.look_photo_path then
    new.look_consent := null;
    new.look_consent_at := null;
    new.look_consent_asked_at := null;
    new.look_on_profile := false;
  end if;
  if coalesce(new.look_consent, '') <> 'yes' then
    new.look_on_profile := false;
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_look_consent_guard on public.bookings;
create trigger bookings_look_consent_guard before update of look_photo_path, look_consent, look_on_profile on public.bookings
  for each row execute function public.bookings_look_consent_guard();

-- Pros choose which consented photos show (the check above enforces consent).
grant update (look_on_profile) on public.bookings to authenticated;

-- The client answers from their client home (signed in with the Pro ID).
create or replace function public.client_look_consent(p_code text, p_booking_id uuid, p_yes boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  s public.stylists;
  b public.bookings;
begin
  select * into s from public.stylists where pro_code = public.clean_pro_code(p_code);
  select * into b from public.bookings where id = p_booking_id and stylist_id = s.id;
  if b.id is null or not public.is_my_booking(b) or b.look_photo_path is null then raise exception 'not_found'; end if;
  update public.bookings set look_consent = case when p_yes then 'yes' else 'no' end, look_consent_at = now()
  where id = b.id;
  return true;
end;
$$;
revoke execute on function public.client_look_consent(text, uuid, boolean) from public;
grant execute on function public.client_look_consent(text, uuid, boolean) to anon, authenticated;

-- Pausing a pro (Admin > Pros > a pro): their booking page shows "paused" and
-- no client can book, by any route (online, waitlist claim, invite, request).
-- The pro can still add bookings themselves, and the server (service role)
-- isn't blocked. Existing bookings are untouched.
alter table public.stylists add column if not exists paused_at timestamptz;
alter table public.stylists add column if not exists paused_reason text not null default '';

create or replace function public.block_paused_bookings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.stylists s where s.id = new.stylist_id and s.paused_at is not null)
     and auth.uid() is distinct from new.stylist_id
     and coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '') <> 'service_role'
  then
    raise exception 'This booking page is paused right now.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_block_paused on public.bookings;
create trigger bookings_block_paused
  before insert on public.bookings
  for each row execute function public.block_paused_bookings();

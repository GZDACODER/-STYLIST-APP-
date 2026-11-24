-- Step 63: Insights. When a booking was cancelled (for the late-cancel rate;
-- from now on), and when a client was last invited back.

alter table public.bookings add column if not exists cancelled_at timestamptz;

create or replace function public.bookings_stamp_cancelled()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
  elsif new.status <> 'cancelled' then
    new.cancelled_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_stamp_cancelled on public.bookings;
create trigger bookings_stamp_cancelled before update of status on public.bookings
  for each row execute function public.bookings_stamp_cancelled();

alter table public.clients add column if not exists invited_back_at timestamptz;
grant update (invited_back_at) on public.clients to authenticated;

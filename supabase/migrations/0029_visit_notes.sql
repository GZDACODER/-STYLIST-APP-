-- Step 24: a note on each visit, and the amount still owed.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0023_visit_outcomes.sql first. Running this again later is safe.
--
-- After a visit the business can write a short note ("6N color, 20 vol",
-- "running late, rebooked") and, when the visit is "Balance owed", how much
-- is still owed. Both show on the Notes tab, on Wrap up visits and in the
-- client's History. Nothing is charged automatically.

alter table public.bookings add column if not exists visit_note text;
alter table public.bookings drop constraint if exists bookings_visit_note_check;
alter table public.bookings add constraint bookings_visit_note_check
  check (visit_note is null or char_length(visit_note) <= 1000);

-- In cents. Empty = not written down.
alter table public.bookings add column if not exists owed_cents integer;
alter table public.bookings drop constraint if exists bookings_owed_cents_check;
alter table public.bookings add constraint bookings_owed_cents_check
  check (owed_cents is null or owed_cents between 0 and 10000000);

-- Saves the note and the amount owed for one visit. Only the business's own
-- confirmed visits that have started (the same rule as marking how it went).
-- An empty note or amount clears it.
create or replace function public.set_visit_note(p_booking_id uuid, p_note text, p_owed_cents integer)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  if auth.uid() is null then
    raise exception 'not_logged_in';
  end if;
  if v_note is not null and char_length(v_note) > 1000 then
    raise exception 'note_too_long';
  end if;
  if p_owed_cents is not null and (p_owed_cents < 0 or p_owed_cents > 10000000) then
    raise exception 'invalid_amount';
  end if;

  update public.bookings b
  set visit_note = v_note,
      owed_cents = p_owed_cents
  from public.stylists s
  where b.id = p_booking_id
    and s.id = b.stylist_id
    and b.stylist_id = auth.uid()
    and b.status = 'confirmed'
    and b.booking_date + b.start_time <= now() at time zone s.timezone;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

revoke execute on function public.set_visit_note(uuid, text, integer) from public, anon;
grant execute on function public.set_visit_note(uuid, text, integer) to authenticated;

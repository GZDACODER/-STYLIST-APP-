-- Step 23: merge two client cards for the same person.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Running this again later is safe. Nothing else changes.
--
-- The same person can end up with two cards (one added by hand, one made
-- when they booked online). merge_clients() moves everything from one card
-- (p_remove) onto the other (p_keep), then deletes the empty card:
--   * every booking: visit history, upcoming visits, deposits, outcomes
--   * standing appointments
--   * notes (both cards' notes, kept together)
--   * status: Blocked if either card is Blocked, otherwise Regular if either
--     is Regular, otherwise New
--   * "Invited" (the earliest invite)
-- The business picks the name, phone number and email the card keeps.
-- It all happens at once: if anything fails, nothing changes.

create or replace function public.merge_clients(
  p_keep uuid,
  p_remove uuid,
  p_name text,
  p_phone text,
  p_email text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_keep public.clients;
  v_remove public.clients;
  v_name text := btrim(coalesce(p_name, ''));
  v_phone text := nullif(btrim(coalesce(p_phone, '')), '');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_keep_notes text;
  v_remove_notes text;
  v_notes text;
  v_status text;
begin
  if v_uid is null then
    raise exception 'not_logged_in';
  end if;
  if p_keep is null or p_remove is null or p_keep = p_remove then
    raise exception 'same_client';
  end if;

  -- Lock both cards (always in the same order), so two taps can't race.
  perform 1 from public.clients
  where id in (p_keep, p_remove) and stylist_id = v_uid
  order by id
  for update;

  select * into v_keep from public.clients where id = p_keep and stylist_id = v_uid;
  if not found then
    raise exception 'client_not_found';
  end if;
  select * into v_remove from public.clients where id = p_remove and stylist_id = v_uid;
  if not found then
    raise exception 'client_not_found';
  end if;

  if char_length(v_name) not between 1 and 100 then
    raise exception 'invalid_name';
  end if;
  if v_phone is not null and char_length(v_phone) > 30 then
    raise exception 'invalid_phone';
  end if;
  if v_email is not null and (char_length(v_email) > 254 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$') then
    raise exception 'invalid_email';
  end if;

  -- Two standing appointments on the same day and time can't both live on
  -- one card. The business ends one first.
  if exists (
    select 1
    from public.standing_series a
    join public.standing_series b
      on b.weekday = a.weekday and b.start_time = a.start_time
    where a.client_id = p_keep and a.status = 'active'
      and b.client_id = p_remove and b.status = 'active'
  ) then
    raise exception 'standing_clash';
  end if;

  -- Both cards' notes, without repeating them if they're the same.
  v_keep_notes := nullif(btrim(coalesce(v_keep.notes, '')), '');
  v_remove_notes := nullif(btrim(coalesce(v_remove.notes, '')), '');
  if v_remove_notes is not null and v_remove_notes is not distinct from v_keep_notes then
    v_remove_notes := null;
  end if;
  v_notes := nullif(concat_ws(E'\n\n', v_keep_notes, v_remove_notes), '');
  if char_length(v_notes) > 1000 then
    raise exception 'notes_too_long';
  end if;

  v_status := case
    when 'blocked' in (v_keep.status, v_remove.status) then 'blocked'
    when 'regular' in (v_keep.status, v_remove.status) then 'regular'
    else 'new'
  end;

  -- Move everything onto the card being kept.
  update public.bookings set client_id = p_keep
  where client_id = p_remove and stylist_id = v_uid;

  update public.standing_series set client_id = p_keep
  where client_id = p_remove and stylist_id = v_uid;

  delete from public.clients where id = p_remove and stylist_id = v_uid;

  update public.clients
  set name = v_name,
      phone = v_phone,
      email = v_email,
      notes = v_notes,
      status = v_status,
      -- Taken off Regular by hand on either card: don't make them a Regular
      -- again automatically.
      auto_regular = v_keep.auto_regular and v_remove.auto_regular,
      invited_at = least(v_keep.invited_at, v_remove.invited_at),
      invite_id = coalesce(v_keep.invite_id, v_remove.invite_id),
      created_at = least(v_keep.created_at, v_remove.created_at)
  where id = p_keep and stylist_id = v_uid;
end;
$$;

revoke execute on function public.merge_clients(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.merge_clients(uuid, uuid, text, text, text) to authenticated;

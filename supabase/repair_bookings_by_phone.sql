-- One-time repair: bookings that went onto the wrong client card.
--
-- Before fixes 0011 and 0012, someone who confirmed by email was put on the
-- card of the client with that email, even when they booked with a different
-- phone number. Those bookings show that client's label (often "Regular").
-- This moves each one to the card for the phone number it was booked with
-- (making a New card if there isn't one), and links a booking to its invite
-- link when the invite was made out to that phone number, so the invite shows
-- Used and the client shows Invited.
--
-- Run 0011_match_by_phone.sql and 0012_invite_wins.sql first.
-- Then run PART 1 on its own to see what would change (it changes nothing).
-- If the list looks right, run PART 2. Running PART 2 again is safe.

-- ============ PART 1: preview (changes nothing) ============
select
  b.booking_date,
  b.start_time,
  b.client_name as booked_as,
  b.client_phone as booked_with_phone,
  b.status,
  c.name as currently_on_card,
  c.status as card_status,
  coalesce(
    (select x.name from public.clients x
     where x.stylist_id = b.stylist_id and x.id <> c.id
       and public.phone_key(x.phone) = public.phone_key(b.client_phone)
     limit 1),
    'a new card'
  ) as will_move_to,
  (select i.name from public.client_invites i
   where i.stylist_id = b.stylist_id
     and public.phone_key(i.phone) = public.phone_key(b.client_phone)
     and b.invite_id is null
   order by i.created_at desc
   limit 1) as will_link_invite
from public.bookings b
join public.clients c on c.id = b.client_id
where public.phone_key(b.client_phone) is distinct from public.phone_key(c.phone)
  and public.phone_key(b.client_phone) is not null
order by b.booking_date, b.start_time;

-- ============ PART 2: repair ============
do $repair$
declare
  b record;
  v_client_id uuid;
  v_invite_id uuid;
begin
  for b in
    select bk.*
    from public.bookings bk
    join public.clients c on c.id = bk.client_id
    where public.phone_key(bk.client_phone) is distinct from public.phone_key(c.phone)
      and public.phone_key(bk.client_phone) is not null
    -- Confirmed bookings first, so they get the invite before cancelled ones.
    order by (bk.status = 'confirmed') desc, bk.created_at
  loop
    -- The card for the phone number it was booked with (not a blocked one).
    select x.id into v_client_id
    from public.clients x
    where x.stylist_id = b.stylist_id
      and x.status <> 'blocked'
      and public.phone_key(x.phone) = public.phone_key(b.client_phone)
    order by case x.status when 'regular' then 0 else 1 end, x.created_at
    limit 1;

    if v_client_id is null then
      insert into public.clients (stylist_id, name, phone, email, status)
      values (
        b.stylist_id,
        b.client_name,
        b.client_phone,
        -- Leave the email off if another card already has it, so the two
        -- don't get mixed up again.
        case when exists (
          select 1 from public.clients x
          where x.stylist_id = b.stylist_id and lower(x.email) = lower(b.client_email)
        ) then null else b.client_email end,
        'new'
      )
      returning id into v_client_id;
    end if;

    -- An invite made out to this phone number that no other booking has used.
    v_invite_id := null;
    if b.invite_id is null then
      select i.id into v_invite_id
      from public.client_invites i
      where i.stylist_id = b.stylist_id
        and public.phone_key(i.phone) = public.phone_key(b.client_phone)
        and i.cancelled_at is null
        and not exists (
          select 1 from public.bookings o
          where o.invite_id = i.id and o.status in ('confirmed', 'cancelled', 'pending_payment')
        )
      order by i.created_at desc
      limit 1;
    end if;

    update public.bookings
    set client_id = v_client_id,
        invite_id = coalesce(invite_id, v_invite_id)
    where id = b.id;

    if coalesce(b.invite_id, v_invite_id) is not null then
      update public.clients
      set invited_at = coalesce(invited_at, b.created_at),
          invite_id = coalesce(invite_id, coalesce(b.invite_id, v_invite_id))
      where id = v_client_id;
    end if;
  end loop;
end
$repair$;

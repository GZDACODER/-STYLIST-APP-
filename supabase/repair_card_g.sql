-- One-time repair for card G (replaces repair_bookings_by_phone.sql for this case).
--
--  * Card G is the real Regular: its phone becomes (773) 606-7337 and it stays
--    Regular. Every booking with 773-606-7337 stays on (or comes back to) card G.
--  * Bookings with 773-606-7283, 708-555-1234 or 773-555-1234 move to a card of
--    their own for that number (an existing one, or a new card).
--  * The 708-555-1234 bookings are linked to the HYSDH invite, so that invite
--    shows Used and the 708 card shows Invited.
--  * Nothing else is touched.
--
-- Run PART 1 on its own first (it changes nothing). If it looks right, run PART 2.
-- PART 2 stops without changing anything if there isn't exactly one card named
-- G and exactly one invite named HYSDH. Running it again is safe.

-- ============ PART 1: preview (changes nothing) ============
with g as (
  select * from public.clients where lower(trim(name)) = 'g'
),
inv as (
  select * from public.client_invites where lower(trim(name)) = 'hysdh'
),
target as (
  select b.*, public.phone_key(b.client_phone) as pk
  from public.bookings b
  where public.phone_key(b.client_phone) in ('17736067337', '17736067283', '17085551234', '17735551234')
)
select
  (select count(*) from g) as cards_named_g,
  (select string_agg(coalesce(g.phone, '(none)') || ' / ' || g.status, ', ') from g) as card_g_now,
  '(773) 606-7337 / regular' as card_g_after,
  (select count(*) from public.clients x
   where public.phone_key(x.phone) = '17736067337' and x.id not in (select id from g)) as other_cards_with_g_number,
  (select count(*) from inv) as invites_named_hysdh,
  (select string_agg(coalesce(inv.phone, '(none)') || ' / ' || public.invite_state(inv), ', ') from inv) as hysdh_now,
  t.booking_date,
  t.start_time,
  t.client_name as booked_as,
  t.client_phone,
  t.status,
  c.name || ' (' || c.status || ')' as now_on_card,
  case
    when t.pk = '17736067337' then 'card G (Regular)'
    else coalesce(
      (select x.name || ' (' || x.status || ')' from public.clients x
       where x.stylist_id = t.stylist_id
         and public.phone_key(x.phone) = t.pk
         and x.id not in (select id from g)
         and x.status <> 'blocked'
       order by x.created_at
       limit 1),
      'a new card: ' || t.client_name || ' (new)'
    )
  end as will_be_on,
  case when t.pk = '17085551234' then 'HYSDH' end as will_link_invite
from target t
join public.clients c on c.id = t.client_id
order by t.pk, t.booking_date, t.start_time;

-- ============ PART 2: repair ============
do $repair$
declare
  v_g public.clients;
  v_invite public.client_invites;
  v_count integer;
  v_pk text;
  v_card uuid;
  v_first public.bookings;
begin
  select count(*) into v_count from public.clients where lower(trim(name)) = 'g';
  if v_count <> 1 then
    raise exception 'Expected exactly one client card named G, found %. Nothing was changed.', v_count;
  end if;
  select * into v_g from public.clients where lower(trim(name)) = 'g';

  select count(*) into v_count
  from public.client_invites
  where lower(trim(name)) = 'hysdh' and stylist_id = v_g.stylist_id;
  if v_count <> 1 then
    raise exception 'Expected exactly one invite named HYSDH, found %. Nothing was changed.', v_count;
  end if;
  select * into v_invite
  from public.client_invites
  where lower(trim(name)) = 'hysdh' and stylist_id = v_g.stylist_id;

  -- Card G: the real Regular, with the real number.
  update public.clients
  set phone = '(773) 606-7337', status = 'regular'
  where id = v_g.id;

  update public.bookings
  set client_id = v_g.id
  where stylist_id = v_g.stylist_id
    and public.phone_key(client_phone) = '17736067337';

  -- The other numbers: a card of their own each.
  foreach v_pk in array array['17736067283', '17085551234', '17735551234'] loop
    select * into v_first
    from public.bookings
    where stylist_id = v_g.stylist_id and public.phone_key(client_phone) = v_pk
    order by created_at
    limit 1;
    continue when v_first.id is null;

    v_card := null;
    select x.id into v_card
    from public.clients x
    where x.stylist_id = v_g.stylist_id
      and x.id <> v_g.id
      and x.status <> 'blocked'
      and public.phone_key(x.phone) = v_pk
    order by x.created_at
    limit 1;

    if v_card is null then
      -- No email on the new card: it's card G's email, and sharing it is what
      -- mixed these up in the first place.
      insert into public.clients (stylist_id, name, phone, email, status)
      values (v_g.stylist_id, v_first.client_name, v_first.client_phone, null, 'new')
      returning id into v_card;
    end if;

    update public.bookings
    set client_id = v_card
    where stylist_id = v_g.stylist_id and public.phone_key(client_phone) = v_pk;

    -- The 708 bookings came from the HYSDH invite.
    if v_pk = '17085551234' then
      update public.bookings
      set invite_id = v_invite.id
      where stylist_id = v_g.stylist_id and public.phone_key(client_phone) = v_pk;

      update public.clients
      set invited_at = coalesce(invited_at, v_first.created_at),
          invite_id = coalesce(invite_id, v_invite.id)
      where id = v_card;
    end if;
  end loop;
end
$repair$;

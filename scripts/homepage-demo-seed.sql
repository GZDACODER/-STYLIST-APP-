-- Temporary demo data for retaking the homepage dashboard screenshots.
-- Remove it right after with:
--   delete from payments where stylist_id=(select id from stylists where slug='maison-demo-1f355e');
--   delete from bookings where client_email like 'shot%@example.com';
--   delete from clients where email like 'shot%@example.com';
-- Temporary demo data for homepage screenshots (removed right after).
do $$
declare
  demo uuid := (select id from public.stylists where slug = 'maison-demo-1f355e');
  tz text := (select timezone from public.stylists where slug = 'maison-demo-1f355e');
  today date := (now() at time zone tz)::date;
  c record; s record; i int; d date;
  names text[] := array['Maya Jones','Leah Kim','Tasha Williams','Ana Ruiz','Jordan Price','Priya Shah','Bri Johnson'];
  ids uuid[] := '{}';
  sv uuid[]; sn text[]; sp int[]; sd int[];
begin
  for i in 1..array_length(names,1) loop
    insert into public.clients (stylist_id, name, email, phone, status)
    values (demo, names[i], 'shot' || i || '@example.com', '555010' || lpad((40 + i)::text, 4, '0'), case when i <= 3 then 'regular' else 'new' end)
    returning id into c;
    ids := ids || c.id;
  end loop;
  select array_agg(id order by created_at), array_agg(name order by created_at), array_agg(price_cents order by created_at), array_agg(duration_minutes order by created_at)
    into sv, sn, sp, sd from public.services where stylist_id = demo;
  -- Past visits this month.
  for i in 0..15 loop
    d := today - (1 + i * 1.3)::int;
    -- Closed Sunday and Monday: move to the Saturday before (skipping lost
    -- the one "balance owed" visit when it fell on a Sunday).
    if extract(dow from d) = 0 then d := d - 1; elsif extract(dow from d) = 1 then d := d - 2; end if;
    insert into public.bookings (stylist_id, service_id, service_name, price_cents, booking_date, start_time, end_time, client_id, client_name, client_email, client_phone, status, outcome, cancel_token, confirmation_sent_at, reminder_sent_at, after_visit_sent_at)
    values (demo, sv[1 + i % 4], sn[1 + i % 4], sp[1 + i % 4], d, time '10:00' + (i % 3) * interval '2 hours', time '10:00' + (i % 3) * interval '2 hours' + make_interval(mins => least(sd[1 + i % 4], 120)),
            ids[1 + (i * 3) % 7], names[1 + (i * 3) % 7], 'shot' || (1 + (i * 3) % 7) || '@example.com', '555010' || lpad((40 + 1 + (i * 3) % 7)::text, 4, '0'), 'confirmed',
            case when i = 6 then 'completed_owed' else 'completed_paid' end, encode(gen_random_bytes(32), 'hex'), now(), now(), now());
  end loop;
  -- Last month too (so 'came back' and 'returning' have something to compare).
  for i in 0..9 loop
    d := today - 30 - (i * 2);
    if extract(dow from d) in (0, 1) then d := d - 2; end if;
    insert into public.bookings (stylist_id, service_id, service_name, price_cents, booking_date, start_time, end_time, client_id, client_name, client_email, client_phone, status, outcome, cancel_token, confirmation_sent_at, reminder_sent_at, after_visit_sent_at)
    values (demo, sv[1 + i % 4], sn[1 + i % 4], sp[1 + i % 4], d, time '09:00' + make_interval(mins => (i % 5) * 65), time '10:00' + make_interval(mins => (i % 5) * 65), ids[1 + i % 5], names[1 + i % 5], 'shot' || (1 + i % 5) || '@example.com',
            '555010' || lpad((40 + 1 + i % 5)::text, 4, '0'), 'confirmed', 'completed_paid', encode(gen_random_bytes(32), 'hex'), now(), now(), now());
  end loop;
  -- Today.
  for i in 0..2 loop
    insert into public.bookings (stylist_id, service_id, service_name, price_cents, booking_date, start_time, end_time, client_id, client_name, client_email, client_phone, status, deposit_cents, deposit_status, cancel_token, confirmation_sent_at, reminder_sent_at, after_visit_sent_at)
    values (demo, sv[1 + i], sn[1 + i], sp[1 + i], today, (array[time '10:00', time '13:00', time '16:30'])[i + 1], (array[time '11:00', time '15:00', time '18:30'])[i + 1],
            ids[1 + i * 2], names[1 + i * 2], 'shot' || (1 + i * 2) || '@example.com', '555010' || lpad((40 + 1 + i * 2)::text, 4, '0'), 'confirmed',
            case when i = 1 then 4000 else 0 end, case when i = 1 then 'paid' else 'none' end, encode(gen_random_bytes(32), 'hex'), now(), now(), now());
  end loop;
  insert into public.payments (stylist_id, client_name, kind, method, amount_cents, paid_on) values
    (demo, 'Maya Jones', 'tip', 'cashapp', 2000, today - 2), (demo, 'Leah Kim', 'tip', 'cash', 1500, today - 4),
    (demo, null, 'product', 'zelle', 3800, today - 6), (demo, 'Tasha Williams', 'tip', 'venmo', 2500, today - 9);
end $$;

-- Step 49: the public demo salon (clientelesuite.com/demo, lib/demo.js).
-- demo_reset(): puts the demo account (demo@clientelesuite.com) back to its
-- starting point: everything visitors added is removed, the sample services
-- (with aftercare), working hours and two weeks of openings are put back,
-- the business details are restored, examples are on and the plan is
-- comped. Runs every night at 3:07 AM Central (pg_cron) and when the demo
-- is first opened. Does nothing if the demo account doesn't exist.
-- Server only. Safe to run more than once.

create or replace function public.demo_reset()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  demo uuid;
  t text;
  pass int;
  tz text := 'America/Chicago';
  d date;
begin
  select id into demo from auth.users where lower(email) = 'demo@clientelesuite.com';
  if demo is null then return false; end if;

  -- Everything the demo owns, in every table with a stylist_id. A few
  -- passes, so rows that point at each other go in the right order.
  for pass in 1..4 loop
    for t in
      select c.table_name from information_schema.columns c
      join information_schema.tables x on x.table_schema = c.table_schema and x.table_name = c.table_name
      where c.table_schema = 'public' and c.column_name = 'stylist_id' and x.table_type = 'BASE TABLE'
        and c.table_name not in ('stylists', 'stylist_plans')
    loop
      begin
        execute format('delete from public.%I where stylist_id = $1', t) using demo;
      exception when foreign_key_violation then null;
      end;
    end loop;
  end loop;
  delete from public.onboarding_guides_seen where user_id = demo;

  update public.stylists set
    business_name = 'Maison Demo',
    first_name = 'Demo',
    business_type = 'hair',
    timezone = tz,
    tagline = 'Silk presses, braids, color and lashes',
    cover_photo_url = '',
    instagram = '',
    show_examples = true,
    regular_perks = 'A free deep condition every 5th visit',
    birthday_perk = '15% off any visit in your birthday month'
  where id = demo;

  insert into public.stylist_plans (stylist_id, comped) values (demo, true)
  on conflict (stylist_id) do update set comped = true;

  insert into public.services (stylist_id, name, price_cents, duration_minutes, aftercare) values
    (demo, 'Silk press', 8500, 60, $t$Wrap your hair every night with a satin scarf or bonnet, or sleep on a satin pillowcase. Keep it away from water, sweat and humidity, since moisture brings your curls back; wear a shower cap and carry an umbrella. Skip heavy oils and greases, which weigh it down. A tiny drop of light serum on the ends is enough. Avoid extra flat-ironing; if you must, use low heat with a heat protectant. Expect it to last about 1–2 weeks. Book your next press or a wash and deep condition then.$t$),
    (demo, 'Knotless braids', 22000, 300, $t$Sleep in a satin bonnet or scarf to keep frizz down. Every few days, mist your scalp lightly with a water-based spray or a little light oil, and don't use heavy grease. Wash every 2 weeks if needed: dilute your shampoo, focus on the scalp, rinse well and let them dry completely so they don't mildew. Don't pull your braids into tight styles for the first few days. Please take them out within 6–8 weeks to protect your edges and avoid matting, and message me if you'd like me to remove them.$t$),
    (demo, 'Color', 12000, 120, $t$Wait at least 48–72 hours before your first wash so the color can set. Use sulfate-free, color-safe shampoo and conditioner, and rinse with cool water. Hot water fades color faster. Deep condition once a week, especially after lightening. Use a heat protectant every time you style with heat, and wear a hat or UV-protecting spray in strong sun. Chlorine and salt water fade color, so wet your hair with clean water first and rinse right after swimming. Book a gloss or touch-up in about 6–8 weeks.$t$),
    (demo, 'Classic lash set', 15000, 120, $t$Keep your lashes completely dry for the first 24 hours: no water, steam, sauna or heavy sweating. After that, wash them every day or two with lash cleanser and a soft brush, then brush them through gently with a clean spoolie. Use oil-free makeup remover and skip mascara, especially waterproof. Don't rub, pull or pick at them, don't use a lash curler, and try not to sleep face-down. Book a fill every 2–3 weeks to keep them full.$t$);

  -- Tuesday to Saturday, 9 to 6.
  insert into public.working_hours (stylist_id, weekday, is_working, start_time, end_time)
  select demo, w, w between 2 and 6, case when w between 2 and 6 then time '09:00' end, case when w between 2 and 6 then time '18:00' end
  from generate_series(0, 6) w;

  -- Open for booking on working days for the next two weeks.
  for d in select generate_series((now() at time zone tz)::date + 1, (now() at time zone tz)::date + 14, interval '1 day')::date loop
    if extract(dow from d) between 2 and 6 then
      insert into public.openings (stylist_id, opening_date, start_time, end_time, visibility)
      values (demo, d, time '09:00', time '18:00', 'everyone');
    end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.demo_reset() from public, anon, authenticated;
grant execute on function public.demo_reset() to service_role;

-- Every night at 3:07 AM Central (9:07 UTC; 8:07 UTC in summer is fine too).
select cron.schedule('demo-reset', '7 9 * * *', $job$ select public.demo_reset() $job$);

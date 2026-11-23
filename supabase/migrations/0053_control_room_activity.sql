-- Step 48: the Control Room's Activity tab (/dashboard/admin/control/activity).
-- ops_activity(): every pro with their setup, plan and bookings, a feed of
-- recent sign-ups, bookings and waitlist matches, and deposits. Clients
-- appear only as counts and first names in the feed. Server only.
-- Safe to run more than once.

create or replace function public.ops_activity()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'pros', coalesce((
      select jsonb_agg(p order by p->>'created_at' desc) from (
        select jsonb_build_object(
          'id', s.id,
          'business_name', s.business_name,
          'business_type', s.business_type,
          'pro_code', s.pro_code,
          'slug', s.slug,
          'email', u.email,
          'created_at', s.created_at,
          'last_sign_in', u.last_sign_in_at,
          'services', (select count(*) from public.services x where x.stylist_id = s.id),
          'hours', (select count(*) from public.working_hours x where x.stylist_id = s.id and x.is_working),
          'stripe', coalesce(s.stripe_charges_enabled, false),
          'cover', s.cover_photo_url is not null,
          'bookings_total', (select count(*) from public.bookings b where b.stylist_id = s.id and b.status = 'confirmed'),
          'bookings_7d', (select count(*) from public.bookings b where b.stylist_id = s.id and b.status = 'confirmed' and b.created_at > now() - interval '7 days'),
          'bookings_30d', (select count(*) from public.bookings b where b.stylist_id = s.id and b.status = 'confirmed' and b.created_at > now() - interval '30 days'),
          'upcoming', (select count(*) from public.bookings b where b.stylist_id = s.id and b.status = 'confirmed' and b.booking_date >= current_date),
          'clients', (select count(*) from public.clients c where c.stylist_id = s.id),
          'trial_ends_at', pl.trial_ends_at,
          'comped', coalesce(pl.comped, false),
          'paying', coalesce(pl.base_active or pl.regulars_active or pl.waitlist_active, false),
          'stripe_status', pl.stripe_status,
          'interval', pl.billing_interval,
          'team_members', coalesce(pl.team_members, 0),
          'assistant', coalesce(pl.assistant_active, false)
        ) as p
        from public.stylists s
        left join auth.users u on u.id = s.id
        left join public.stylist_plans pl on pl.stylist_id = s.id
      ) q
    ), '[]'::jsonb),

    'feed', coalesce((
      select jsonb_agg(e order by e->>'at' desc) from (
        (select jsonb_build_object('at', s.created_at, 'kind', 'signup', 'pro', s.business_name) as e
           from public.stylists s order by s.created_at desc limit 20)
        union all
        (select jsonb_build_object('at', b.created_at, 'kind', case when b.status = 'cancelled' then 'cancelled' else 'booking' end,
            'pro', s.business_name, 'client', split_part(coalesce(b.client_name, ''), ' ', 1),
            'service', b.service_name, 'date', b.booking_date, 'time', b.start_time,
            'deposit', case when b.deposit_status = 'paid' then b.deposit_cents else 0 end) as e
           from public.bookings b join public.stylists s on s.id = b.stylist_id
           order by b.created_at desc limit 40)
        union all
        (select jsonb_build_object('at', o.claimed_at, 'kind', 'waitlist', 'pro', s.business_name, 'date', o.slot_date, 'time', o.slot_time) as e
           from public.waitlist_offers o join public.stylists s on s.id = o.stylist_id
           where o.claimed_at is not null order by o.claimed_at desc limit 15)
      ) f
    ), '[]'::jsonb),

    'deposits_30d', (select coalesce(sum(deposit_cents), 0) from public.bookings
                     where deposit_status = 'paid' and created_at > now() - interval '30 days'),
    'no_shows_30d', (select count(*) from public.bookings
                     where outcome = 'no_show' and booking_date > current_date - 30),
    'cancelled_30d', (select count(*) from public.bookings
                      where status = 'cancelled' and created_at > now() - interval '30 days')
  )
$$;

revoke all on function public.ops_activity() from public, anon, authenticated;
grant execute on function public.ops_activity() to service_role;

-- Step 59: find a pro (clientelesuite.com/find). Only pros with their public
-- profile on AND "Show me in search" on are ever returned. Server only.

create or replace function public.search_pros(p_q text, p_type text default null, p_city text default null, p_limit integer default 30)
returns table (
  id uuid, slug text, handle text, business_name text, owner_name text, business_type text, city text,
  cover_photo_url text, regulars_only boolean, profile_show jsonb, rating numeric, ratings integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with q as (
    select nullif(trim(coalesce(p_q, '')), '') as text,
           public.clean_pro_code(p_q) as code,
           -- Typed text is matched literally (no wildcards).
           '%' || replace(replace(replace(trim(coalesce(p_q, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%' as pat
  )
  select s.id, s.slug, s.handle, s.business_name, s.owner_name, s.business_type, s.city,
         s.cover_photo_url, s.regulars_only, s.profile_show,
         round(avg(f.rating)::numeric, 1), count(f.rating)::integer
  from public.stylists s
  cross join q
  left join public.visit_feedback f on f.stylist_id = s.id and not f.hidden
  where s.profile_on and s.in_search and s.handle is not null
    and s.slug !~* '^(maison-demo|demo-barber|demo-tattoo|demo-tutor)-[0-9a-f]{6}$'
    and (q.text is null
         or s.business_name ilike q.pat or s.owner_name ilike q.pat or s.handle ilike q.pat
         or (q.code is not null and s.pro_code = q.code))
    and (nullif(p_type, '') is null or coalesce(nullif(s.business_type, ''), 'hair') = p_type)
    and (nullif(trim(coalesce(p_city, '')), '') is null or lower(trim(s.city)) = lower(trim(p_city)))
  group by s.id, q.text, q.code
  order by
    -- Exact name or Pro ID first, then names that start with the search.
    (q.code is not null and s.pro_code = q.code) desc,
    (lower(s.business_name) = lower(coalesce(q.text, ''))) desc,
    (s.business_name ilike coalesce(q.text, '') || '%') desc,
    count(f.rating) desc,
    s.business_name
  limit least(greatest(coalesce(p_limit, 30), 1), 50);
$$;
revoke execute on function public.search_pros(text, text, text, integer) from public, anon, authenticated;
grant execute on function public.search_pros(text, text, text, integer) to service_role;

-- The cities searchable pros are in, for the filter.
create or replace function public.search_cities()
returns table (city text, pros integer)
language sql
stable
security definer
set search_path = ''
as $$
  select min(trim(city)), count(*)::integer from public.stylists
  where profile_on and in_search and handle is not null and nullif(trim(coalesce(city, '')), '') is not null
  group by lower(trim(city)) order by 2 desc, 1 limit 200;
$$;
revoke execute on function public.search_cities() from public, anon, authenticated;
grant execute on function public.search_cities() to service_role;

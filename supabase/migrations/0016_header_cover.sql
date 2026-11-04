-- Step 12: the waitlist, claim and paid pages show the stylist's panel too.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0014_cover_and_links.sql first. Running this again later is safe.
-- Read-only: the top bar lookup also returns the cover photo. Nothing else changes.

create or replace function public.get_booking_header(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'business_name', s.business_name,
    'instagram', s.instagram,
    'location', s.location,
    'cover_photo_url', s.cover_photo_url
  )
  from public.stylists s
  where s.slug = lower(p_slug);
$$;

revoke execute on function public.get_booking_header(text) from public;
grant execute on function public.get_booking_header(text) to anon, authenticated;

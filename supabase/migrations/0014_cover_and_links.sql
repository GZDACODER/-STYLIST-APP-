-- Step 10: a cover photo, Instagram and location on the stylist's booking page.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0013_tagline.sql first. Running this again later is safe.
-- Nothing about booking, deposits, the waitlist, invites or Regulars only changes.

-- ============ PROFILE FIELDS ============
-- cover_photo_url: the public link of the photo in the "covers" bucket. Empty = none.
-- instagram: just the handle, without the @ (like "cutsbysam"). Empty = none.
-- location: the salon's address or area, shown as a map link. Empty = none.
alter table public.stylists add column if not exists cover_photo_url text not null default '';
alter table public.stylists add column if not exists instagram text not null default '';
alter table public.stylists add column if not exists location text not null default '';

alter table public.stylists drop constraint if exists stylists_cover_photo_url_format;
alter table public.stylists add constraint stylists_cover_photo_url_format
  check (cover_photo_url = '' or (cover_photo_url like 'https://%' and char_length(cover_photo_url) <= 500));

alter table public.stylists drop constraint if exists stylists_instagram_format;
alter table public.stylists add constraint stylists_instagram_format
  check (instagram ~ '^[A-Za-z0-9._]{0,30}$');

alter table public.stylists drop constraint if exists stylists_location_length;
alter table public.stylists add constraint stylists_location_length
  check (char_length(location) <= 200);

-- Stylists can change these themselves in Settings.
grant update (cover_photo_url, instagram, location) on public.stylists to authenticated;

-- ============ COVER PHOTO STORAGE ============
-- A public bucket: anyone can view a cover photo (it's on a public page).
-- Up to 5 MB, photos only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Each stylist can only add, replace and delete files in their own folder
-- (the folder is named with their id, like covers/<id>/cover-123.jpg).
drop policy if exists "Stylists can upload own cover" on storage.objects;
create policy "Stylists can upload own cover"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'covers'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.stylists where id = (select auth.uid()))
  );

drop policy if exists "Stylists can see own cover files" on storage.objects;
create policy "Stylists can see own cover files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Stylists can replace own cover" on storage.objects;
create policy "Stylists can replace own cover"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Stylists can delete own cover" on storage.objects;
create policy "Stylists can delete own cover"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'covers' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============ BOOKING PAGE TOP BAR ============
-- Public: just the name and links for the top bar of every booking page
-- (booking, waitlist, claim, paid). Read-only, no other details.
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
    'location', s.location
  )
  from public.stylists s
  where s.slug = lower(p_slug);
$$;

revoke execute on function public.get_booking_header(text) from public;
grant execute on function public.get_booking_header(text) to anon, authenticated;

-- ============ BOOKING PAGE ============
-- Public: the stylist's page. Exactly the same as step 9, plus the cover
-- photo, Instagram and location.
create or replace function public.get_booking_page(p_slug text, p_invite text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_stylist public.stylists;
  v_invite public.client_invites;
begin
  select * into v_stylist from public.stylists where slug = lower(p_slug);
  if not found then
    return null;
  end if;

  perform public.apply_auto_regulars(v_stylist.id);

  if p_invite is not null then
    select * into v_invite from public.client_invites
    where stylist_id = v_stylist.id and token = p_invite;
  end if;

  return jsonb_build_object(
    'business_name', v_stylist.business_name,
    'tagline', v_stylist.tagline,
    'cover_photo_url', v_stylist.cover_photo_url,
    'instagram', v_stylist.instagram,
    'location', v_stylist.location,
    'slug', v_stylist.slug,
    'timezone', v_stylist.timezone,
    'cancellation_policy', v_stylist.cancellation_policy,
    'waitlist_enabled', v_stylist.waitlist_enabled,
    'regulars_only', v_stylist.regulars_only,
    -- What they can do: 'regular', 'invited', 'new', 'unknown', 'anonymous' or 'blocked'.
    'access', public.booking_access(v_stylist.id, p_invite),
    -- The invite link they came with: 'open', 'used', 'expired', 'cancelled',
    -- 'busy' (someone is paying a deposit with it) or 'invalid'.
    'invite', case
      when p_invite is null then null
      when v_invite.id is null then jsonb_build_object('state', 'invalid')
      when (public.booking_find_invite(v_stylist.id, p_invite)).id is not null
        then jsonb_build_object('state', 'open', 'name', v_invite.name)
      when public.invite_state(v_invite) = 'open'
        then jsonb_build_object('state', 'busy', 'name', v_invite.name)
      else jsonb_build_object('state', public.invite_state(v_invite), 'name', v_invite.name)
    end,
    'viewer_status', public.booking_viewer_status(v_stylist.id),
    'viewer_email', public.booking_verified_email(),
    'viewer_phone', public.booking_verified_phone(),
    'services', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', sv.id,
            'name', sv.name,
            'price_cents', sv.price_cents,
            'duration_minutes', sv.duration_minutes,
            'deposit_cents', public.service_deposit_cents(v_stylist, sv)
          )
          order by sv.created_at
        )
        from public.services sv
        where sv.stylist_id = v_stylist.id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke execute on function public.get_booking_page(text, text) from public;
grant execute on function public.get_booking_page(text, text) to anon, authenticated;

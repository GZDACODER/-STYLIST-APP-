-- Step 26: portfolio photos on the booking page.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0014_cover_and_links.sql first. Running this again later is safe.
--
-- Each business can show up to 12 photos of their work on their booking
-- page, in the order they choose, each with an optional caption. Photos are
-- added in Settings -> Your business. They live in their own public storage
-- bucket ("portfolio"), in a folder named with the business's id, apart from
-- the cover photo (which replaces everything in its own folder).

-- ============ STORAGE ============
-- Public (they're on a public page). Up to 5 MB, photos only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio', 'portfolio', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Each business can only add, see, replace and delete files in its own folder.
drop policy if exists "Stylists can upload own portfolio" on storage.objects;
create policy "Stylists can upload own portfolio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'portfolio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Stylists can see own portfolio files" on storage.objects;
create policy "Stylists can see own portfolio files"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Stylists can replace own portfolio" on storage.objects;
create policy "Stylists can replace own portfolio"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Stylists can delete own portfolio" on storage.objects;
create policy "Stylists can delete own portfolio"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'portfolio' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ============ THE PHOTOS ============
create table if not exists public.portfolio_photos (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  -- Where the file is in the "portfolio" bucket: <stylist id>/<file>.jpg
  path text not null unique check (char_length(path) <= 200),
  -- Its public link.
  url text not null check (url ~ '^https://' and char_length(url) <= 500),
  caption text not null default '' check (char_length(caption) <= 120),
  -- Lower first.
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists portfolio_photos_stylist_idx on public.portfolio_photos (stylist_id, position);

alter table public.portfolio_photos enable row level security;

-- A business sees and changes only its own photos.
drop policy if exists "Stylists can view own portfolio" on public.portfolio_photos;
create policy "Stylists can view own portfolio"
  on public.portfolio_photos for select
  to authenticated
  using ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can add own portfolio" on public.portfolio_photos;
create policy "Stylists can add own portfolio"
  on public.portfolio_photos for insert
  to authenticated
  with check (
    (select auth.uid()) = stylist_id
    and (storage.foldername(path))[1] = (select auth.uid())::text
  );

drop policy if exists "Stylists can update own portfolio" on public.portfolio_photos;
create policy "Stylists can update own portfolio"
  on public.portfolio_photos for update
  to authenticated
  using ((select auth.uid()) = stylist_id)
  with check ((select auth.uid()) = stylist_id);

drop policy if exists "Stylists can delete own portfolio" on public.portfolio_photos;
create policy "Stylists can delete own portfolio"
  on public.portfolio_photos for delete
  to authenticated
  using ((select auth.uid()) = stylist_id);

-- Only the caption and the order can be changed after a photo is added.
revoke update on public.portfolio_photos from authenticated;
grant update (caption, position) on public.portfolio_photos to authenticated;

-- At most 12 photos per business.
create or replace function public.portfolio_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('portfolio:' || new.stylist_id::text));
  if (select count(*) from public.portfolio_photos where stylist_id = new.stylist_id) >= 12 then
    raise exception 'portfolio_full';
  end if;
  return new;
end;
$$;

drop trigger if exists portfolio_limit on public.portfolio_photos;
create trigger portfolio_limit
  before insert on public.portfolio_photos
  for each row execute function public.portfolio_limit();

-- ============ THE BOOKING PAGE ============
-- A business's photos for its public booking page, in order.
create or replace function public.get_portfolio(p_slug text)
returns table (url text, caption text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.url, p.caption
  from public.portfolio_photos p
  join public.stylists s on s.id = p.stylist_id
  where s.slug = lower(p_slug)
  order by p.position, p.created_at
  limit 12
$$;

revoke execute on function public.portfolio_limit() from public, anon, authenticated;
revoke execute on function public.get_portfolio(text) from public;
grant execute on function public.get_portfolio(text) to anon, authenticated;

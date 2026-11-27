-- "We'll set it up for you": import services from screenshots of another
-- app (Services → Import from another app). Free on every plan.
--
-- 1. A private storage bucket, service-imports. Each pro's screenshots live
--    in a folder named with their user id: <user id>/<import id>/<n>.jpg.
-- 2. service_imports: one row per import, with what Claude read
--    (extracted), where it is (status) and when the pro approved it.
-- Pros only ever see and touch their own (row level security).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-imports', 'service-imports', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "service imports: own folder read" on storage.objects;
create policy "service imports: own folder read" on storage.objects
  for select to authenticated
  using (bucket_id = 'service-imports' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "service imports: own folder upload" on storage.objects;
create policy "service imports: own folder upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'service-imports' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "service imports: own folder delete" on storage.objects;
create policy "service imports: own folder delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'service-imports' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.service_imports (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  screenshot_paths text[] not null default '{}',
  extracted jsonb,
  status text not null default 'uploading'
    check (status in ('uploading', 'reading', 'review', 'approved', 'failed')),
  error text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists service_imports_stylist_idx on public.service_imports (stylist_id, created_at desc);

alter table public.service_imports enable row level security;

drop policy if exists "service imports: own rows read" on public.service_imports;
create policy "service imports: own rows read" on public.service_imports
  for select to authenticated using (stylist_id = auth.uid());

drop policy if exists "service imports: own rows add" on public.service_imports;
create policy "service imports: own rows add" on public.service_imports
  for insert to authenticated with check (stylist_id = auth.uid());

drop policy if exists "service imports: own rows change" on public.service_imports;
create policy "service imports: own rows change" on public.service_imports
  for update to authenticated using (stylist_id = auth.uid()) with check (stylist_id = auth.uid());

drop policy if exists "service imports: own rows delete" on public.service_imports;
create policy "service imports: own rows delete" on public.service_imports
  for delete to authenticated using (stylist_id = auth.uid());

grant select, insert, update, delete on public.service_imports to authenticated;

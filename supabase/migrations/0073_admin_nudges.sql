-- Launch week (/dashboard/admin/launch): the personal notes the owner sends
-- new pros from hello@clientelesuite.com, so the page can show "Nudged 2 days
-- ago" and nobody gets the same note twice by accident. Written and read only
-- by the server (admin client); no access for signed-in users.
create table if not exists public.admin_nudges (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  stage text not null,
  subject text not null,
  sent_at timestamptz not null default now()
);
create index if not exists admin_nudges_stylist_idx on public.admin_nudges (stylist_id, sent_at desc);
alter table public.admin_nudges enable row level security;

-- Admin actions (/dashboard/admin/pros): every change the owner makes to a
-- pro's account (founding pro, more free days, free account on/off, an email
-- sent), who made it and when. Kept if the pro deletes their account
-- (stylist_id set to null, business name kept). Server only (admin client).
create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid references public.stylists (id) on delete set null,
  business_name text not null default '',
  admin_email text not null,
  action text not null,
  detail text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists admin_actions_stylist_idx on public.admin_actions (stylist_id, created_at desc);
alter table public.admin_actions enable row level security;

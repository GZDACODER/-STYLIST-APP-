-- Step 54: signed agreements, layer 1 (pros sign Clientele's terms).
--
-- pro_agreements: one row per signature, never changed or deleted: who
--   signed, the typed legal and business names, the boxes ticked, the exact
--   text signed (and its version), the IP address and device, and where the
--   signature image and PDF copy are kept (private "agreements" storage).
--   A new version of the terms means a new signature next time they log in.
-- Pros can read their own; only the server writes (the site's secret key).
-- NOTE: the terms, privacy policy and starter waivers are templates and
-- must be reviewed by a lawyer before launch.
-- Safe to run more than once.

create table if not exists public.pro_agreements (
  id uuid primary key default gen_random_uuid(),
  stylist_id uuid not null references public.stylists (id) on delete cascade,
  kind text not null default 'pro_terms',
  version integer not null,
  signed_at timestamptz not null default now(),
  legal_name text not null check (char_length(legal_name) between 2 and 120),
  business_name text not null check (char_length(business_name) between 1 and 120),
  checks jsonb not null default '{}'::jsonb,
  text_signed text not null,
  signature_path text not null,
  pdf_path text,
  ip text,
  user_agent text
);
create index if not exists pro_agreements_stylist_idx on public.pro_agreements (stylist_id, kind, version desc);
alter table public.pro_agreements enable row level security;
drop policy if exists "Pros see their agreements" on public.pro_agreements;
create policy "Pros see their agreements" on public.pro_agreements
  for select to authenticated using ((select auth.uid()) = stylist_id);
grant select on public.pro_agreements to authenticated;

-- Never changed after signing.
create or replace function public.pro_agreements_frozen()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and (new.text_signed is distinct from old.text_signed or new.version is distinct from old.version
     or new.signature_path is distinct from old.signature_path or new.legal_name is distinct from old.legal_name
     or new.signed_at is distinct from old.signed_at) then
    raise exception 'signed agreements cannot be changed';
  end if;
  return new;
end;
$$;
drop trigger if exists pro_agreements_frozen on public.pro_agreements;
create trigger pro_agreements_frozen before update on public.pro_agreements
  for each row execute function public.pro_agreements_frozen();

-- Private storage for signature images and PDF copies.
insert into storage.buckets (id, name, public)
values ('agreements', 'agreements', false)
on conflict (id) do nothing;

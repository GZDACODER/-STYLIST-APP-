-- Booking page contact section and "Pay over time".
-- Facebook, a public phone and email (behind "See contact details"), an
-- optional map of the location, and the pro's opt-in for Klarna / Afterpay /
-- Affirm on deposits and payment links (lib/payLater.js; those payments
-- carry a 6% + 30 cent fee instead of 3% + 30 cents).

alter table public.stylists add column if not exists facebook text not null default '';
alter table public.stylists add column if not exists contact_phone text not null default '';
alter table public.stylists add column if not exists contact_email text not null default '';
alter table public.stylists add column if not exists show_map boolean not null default false;
alter table public.stylists add column if not exists pay_later_on boolean not null default false;

alter table public.stylists drop constraint if exists stylists_facebook_len;
alter table public.stylists add constraint stylists_facebook_len check (char_length(facebook) <= 200);
alter table public.stylists drop constraint if exists stylists_contact_phone_format;
alter table public.stylists add constraint stylists_contact_phone_format check (contact_phone ~ '^[0-9+(). -]{0,25}$');
alter table public.stylists drop constraint if exists stylists_contact_email_len;
alter table public.stylists add constraint stylists_contact_email_len check (char_length(contact_email) <= 200);

-- The booking pages' header: now with every link and the contact details.
create or replace function public.get_booking_header(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'business_name', s.business_name,
    'instagram', s.instagram,
    'location', s.location,
    'cover_photo_url', s.cover_photo_url,
    'tiktok', s.tiktok,
    'website', s.website,
    'facebook', s.facebook,
    'contact_phone', s.contact_phone,
    'contact_email', s.contact_email,
    'show_map', s.show_map,
    'pay_later_on', s.pay_later_on
  )
  from public.stylists s
  where s.slug = lower(p_slug);
$$;

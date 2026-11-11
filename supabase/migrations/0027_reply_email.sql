-- Step 22: "Email for client replies" in Settings (optional).
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Running this again later is safe. Nothing else changes.
--
-- Client emails (confirmations, reminders, standing appointments, waitlist
-- offers) are sent from hello@clientelesuite.com, with Reply-To set to the
-- business. This is the address replies go to. Empty = the business's
-- login email, as before.

alter table public.stylists add column if not exists reply_email text not null default '';

alter table public.stylists drop constraint if exists stylists_reply_email_check;
alter table public.stylists add constraint stylists_reply_email_check
  check (
    reply_email = ''
    or (char_length(reply_email) <= 254 and reply_email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$')
  );

-- Businesses can change it themselves in Settings.
grant update (reply_email) on public.stylists to authenticated;

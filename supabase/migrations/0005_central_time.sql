-- Step 4 fixes: use Central Time by default.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.

-- New stylists start on Central Time.
alter table public.stylists alter column timezone set default 'America/Chicago';

-- Stylists still on the old default (New York) move to Central Time.
-- Anyone can pick a different time zone later on the Settings tab.
update public.stylists
set timezone = 'America/Chicago'
where timezone = 'America/New_York';

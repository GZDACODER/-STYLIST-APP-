-- Step 35: standing appointments also skip a holiday closed for one date.
-- Paste this whole file into Supabase -> SQL Editor -> New query, then press Run.
-- Run 0039_calendar_extras.sql first. Running this again later is safe.
--
-- "Close every year" (step 34) already counted as closed everywhere. "Closed
-- this holiday" (one date only) is saved as a blocked date called
-- "Closed – Thanksgiving", which standing appointments booked anyway and then
-- flagged. Now both count as closed, so a standing visit on a closed holiday
-- isn't booked (it shows as "Not held" on the Today page, like a Block
-- bookings event) and is booked again if the holiday is reopened.
-- Visits booked before the holiday was closed stay booked and are flagged, so
-- nothing is cancelled silently.

-- Is the business closed for a holiday on this date (every year, or just
-- this date)?
create or replace function public.stylist_closed_on(p_stylist_id uuid, p_day date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.stylist_holiday_settings s
    join public.us_federal_holidays(extract(year from p_day)::integer) h on h.holiday_key = s.holiday_key
    where s.stylist_id = p_stylist_id
      and s.closed
      and h.holiday_date = p_day
  )
  or exists (
    select 1
    from public.blocked_dates d
    where d.stylist_id = p_stylist_id
      and d.blocked_on = p_day
      and d.reason like 'Closed – %'
  )
$$;

revoke execute on function public.stylist_closed_on(uuid, date) from public, anon, authenticated;

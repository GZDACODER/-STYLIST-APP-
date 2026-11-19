// Settings section: Holidays (server component).
import { todayInTimeZone } from "@/lib/availability";
import HolidaySettings from "../HolidaySettings";
import { me, optional } from "./common";

export async function HolidaysSection() {
  const { supabase, user, row } = await me("timezone");
  if (!user) return null;
  const { data, error } = await supabase.from("stylist_holiday_settings").select("holiday_key, closed");
  return (
    <section className="card">
      <p className="muted">
        Close on a federal holiday every year, and clients can&apos;t book it, the waitlist isn&apos;t offered it,
        and standing appointments skip it. Bookings already made stay. All open to start with. To close just one
        year, tap the holiday on your Calendar.
      </p>
      {error ? (
        <p className="message info">
          Run <code>supabase/migrations/0039_calendar_extras.sql</code> in Supabase to switch this on.
        </p>
      ) : (
        <HolidaySettings
          closed={(data || []).filter((r) => r.closed).map((r) => r.holiday_key)}
          today={todayInTimeZone(row.timezone || "America/Chicago")}
        />
      )}
    </section>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, hoursByWeekday, todayInTimeZone } from "@/lib/availability";
import { unblockDate } from "./actions";
import AvailabilityCalendar from "./AvailabilityCalendar";
import WeeklyHoursForm from "./WeeklyHoursForm";
import BlockDatesForm from "./BlockDatesForm";
import SubmitButton from "@/components/SubmitButton";
import { BRAND_NAME } from "@/lib/brand";
import HolidaySettings from "../settings/HolidaySettings";

export const metadata = { title: `Availability · ${BRAND_NAME}` };

export default async function AvailabilityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Skip old blocked dates. We go back two days so a stylist in a
  // different time zone from the server still sees "today".
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - 2);
  const cutoffText = cutoff.toISOString().slice(0, 10);

  const [{ data: hourRows, error: hoursError }, { data: blocked, error: blockedError }] =
    await Promise.all([
      supabase.from("working_hours").select("weekday, is_working, start_time, end_time"),
      supabase
        .from("blocked_dates")
        .select("id, blocked_on, reason")
        .gte("blocked_on", cutoffText)
        .order("blocked_on", { ascending: true }),
    ]);

  const loadError = hoursError || blockedError;
  if (loadError) {
    return (
      <p className="message error">Couldn't load your availability: {loadError.message}</p>
    );
  }

  const hours = hoursByWeekday(hourRows);

  // Holidays the business closes on every year (step 34 SQL); null before it's run.
  const [{ data: stylist }, { data: holidayRows, error: holidayError }] = await Promise.all([
    supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle(),
    supabase.from("stylist_holiday_settings").select("holiday_key, closed"),
  ]);
  const closedHolidays = holidayError ? null : (holidayRows || []).filter((r) => r.closed).map((r) => r.holiday_key);

  return (
    <>
      <section className="card calendar-card">
        <h2>Your calendar</h2>
        <AvailabilityCalendar hours={hours} blocked={blocked} />
      </section>

      <section className="card">
        <h2>Weekly hours</h2>
        <p className="muted">Tick the days you work and set your hours.</p>
        <WeeklyHoursForm savedHours={hours} />
      </section>

      <section className="card" id="holidays">
        <h2>Holidays</h2>
        <p className="muted">
          Close on a federal holiday every year, and clients can&apos;t book it, the waitlist
          isn&apos;t offered it, and standing appointments skip it. Bookings already made stay.
          All open to start with. To close just one year, tap the holiday on your Calendar.
        </p>
        {closedHolidays ? (
          <HolidaySettings closed={closedHolidays} today={todayInTimeZone(stylist?.timezone || "America/Chicago")} />
        ) : (
          <p className="message info">
            Run <code>supabase/migrations/0039_calendar_extras.sql</code> in Supabase to switch this on.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Block out dates</h2>
        <p className="muted">
          Vacation or a day you can't work? Block it here. For several days in a row, also pick
          an "until" date.
        </p>
        <BlockDatesForm />

        {blocked.length > 0 && (
          <>
            <h3 className="list-title">Blocked dates</h3>
            <ul className="service-list">
              {blocked.map((b) => (
                <li key={b.id}>
                  <div>
                    <div className="service-name">{formatDate(b.blocked_on)}</div>
                    {b.reason && <div className="muted">{b.reason}</div>}
                  </div>
                  <form action={unblockDate}>
                    <input type="hidden" name="id" value={b.id} />
                    <SubmitButton className="button secondary small" pendingText="...">
                      Remove
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}

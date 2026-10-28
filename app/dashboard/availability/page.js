import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, hoursByWeekday } from "@/lib/availability";
import { unblockDate } from "./actions";
import AvailabilityCalendar from "./AvailabilityCalendar";
import WeeklyHoursForm from "./WeeklyHoursForm";
import BlockDatesForm from "./BlockDatesForm";
import SubmitButton from "@/components/SubmitButton";

export const metadata = { title: "Availability · Regulars First" };

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

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDate, hoursByWeekday } from "@/lib/availability";
import { unblockDate } from "./actions";
import AvailabilityCalendar from "./AvailabilityCalendar";
import WeeklyHoursForm from "./WeeklyHoursForm";
import BlockDatesForm from "./BlockDatesForm";
import SubmitButton from "@/components/SubmitButton";
import { BRAND_NAME } from "@/lib/brand";
import SettingsShell from "@/components/dash/SettingsShell";
import RowList from "@/components/dash/RowList";
import Link from "next/link";

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
      <SettingsShell active="hours">
        <p className="message error">Couldn't load your availability: {loadError.message}</p>
      </SettingsShell>
    );
  }

  const hours = hoursByWeekday(hourRows);

  return (
    <SettingsShell
      active="hours"
      subtitle={
        <>
          Your week, and dates you can&apos;t work. Federal holidays are under{" "}
          <Link href="/dashboard/settings/holidays">Holidays</Link>.
        </>
      }
    >
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
            <RowList
              label="Hours & days off"
              items={blocked.map((b) => ({
                key: b.id,
                title: formatDate(b.blocked_on),
                sub: b.reason || "Blocked",
                panel: (
                  <>
                    <p className="muted">Clients can&apos;t book this day.{b.reason ? ` Reason: ${b.reason}.` : ""}</p>
                    <form action={unblockDate}>
                      <input type="hidden" name="id" value={b.id} />
                      <SubmitButton className="button secondary small" pendingText="Removing...">
                        Remove block
                      </SubmitButton>
                    </form>
                  </>
                ),
              }))}
            />
          </>
        )}
      </section>
    </SettingsShell>
  );
}

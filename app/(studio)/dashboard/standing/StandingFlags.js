// Today page: standing visits that need a look. Nothing is ever deleted
// silently; the stylist decides (move, skip, or keep it).
import Link from "next/link";
import { dismissStandingFlag } from "./actions";
import { clockTime } from "@/lib/availability";
import { formatPrice } from "@/lib/money";
import { shortDay } from "./describe";
import SubmitButton from "@/components/SubmitButton";

const WHY = {
  day_off: "is on a day you blocked off",
  not_working: "is on a day you don't work",
  outside_hours: "is outside your working hours",
};

export default function StandingFlags({ flags }) {
  if (!flags?.length) return null;

  return (
    <section className="db-flags" aria-label="Standing appointments to check">
      <div className="db-section-head">
        <h2>Standing appointments to check</h2>
      </div>
      <ul className="db-flag-list">
        {flags.map((f) => {
          const when = `${shortDay(f.booking_date)} at ${clockTime(f.start_time)}`;
          const key = `${f.kind}-${f.booking_id || f.series_id}-${f.booking_date}`;
          return (
            <li key={key} className="db-flag">
              <div>
                <span className={`badge ${f.kind === "deposit_unpaid" ? "unpaid" : "standing"}`}>
                  {f.kind === "deposit_unpaid"
                    ? "Deposit unpaid"
                    : f.kind === "clash"
                      ? "Not held"
                      : "Check time"}
                </span>{" "}
                <strong>{f.client_name}</strong> · {f.service_name}
              </div>
              <p className="muted small-text">
                {f.kind === "clash" &&
                  `${when} was already booked, so this visit isn't held. Move the other booking, or dismiss this date.`}
                {WHY[f.kind] && `Their standing visit on ${when} ${WHY[f.kind]}. Move or skip it on the Calendar, or keep it.`}
                {f.kind === "deposit_unpaid" &&
                  `Their ${formatPrice(f.deposit_cents)} deposit for ${when} isn't paid yet. The visit stays booked.`}
              </p>
              <div className="db-flag-actions">
                {f.booking_id && <Link href="/dashboard/bookings">Open Calendar</Link>}
                {f.kind === "clash" && (
                  <form action={dismissStandingFlag}>
                    <input type="hidden" name="series_id" value={f.series_id} />
                    <input type="hidden" name="date" value={f.booking_date} />
                    <SubmitButton className="link-button quiet-link" pendingText="...">
                      Dismiss
                    </SubmitButton>
                  </form>
                )}
                {WHY[f.kind] && (
                  <form action={dismissStandingFlag}>
                    <input type="hidden" name="booking_id" value={f.booking_id} />
                    <SubmitButton className="link-button quiet-link" pendingText="...">
                      Keep it
                    </SubmitButton>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

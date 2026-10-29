// Clients land here from a waitlist message: the times they were told about
// that are still open, and a button to leave the waitlist.
import Link from "next/link";
import { createBookingClient } from "@/lib/supabase/booking";
import { clockTime, formatDate, timeZoneLabel } from "@/lib/availability";
import { describeWishes } from "@/lib/preferences";
import LeaveWaitlist from "./LeaveWaitlist";

export const metadata = { title: "Your waitlist spot" };

export default async function WaitlistPage({ params, searchParams }) {
  const { slug } = await params;
  const { t: token } = await searchParams;

  let entry = null;
  if (typeof token === "string" && /^[0-9a-f]{64}$/.test(token)) {
    const supabase = await createBookingClient();
    const { data } = await supabase.rpc("get_waitlist_entry", { p_token: token });
    entry = data;
  }

  if (!entry) {
    return (
      <section className="card">
        <h2>This link doesn&apos;t work</h2>
        <p className="muted">It may be incomplete. Try tapping the link in your message again.</p>
        <Link href={`/book/${slug}`}>Go to the booking page</Link>
      </section>
    );
  }

  const bookingLink = `/book/${entry.slug}`;

  return (
    <>
      <h1>{entry.business_name}</h1>
      <section className="card">
        <h2>Your waitlist spot</h2>
        <p className="summary">
          <strong>{entry.service_name}</strong>
          <br />
          {describeWishes(entry.days, entry.times)}
        </p>

        {entry.status !== "waiting" ? (
          <>
            <p className="muted">
              {entry.status === "booked"
                ? "You booked a time, so you're off the waitlist."
                : "You're no longer on the waitlist."}
            </p>
            <Link href={bookingLink} className="button secondary">
              See open times
            </Link>
          </>
        ) : (
          <>
            <p className="muted">
              You&apos;re on the waitlist.{" "}
              {entry.email ? `We'll email ${entry.email}` : "We'll let you know"} when a time
              you&apos;d like opens up.
            </p>

            {entry.offers.length > 0 && (
              <>
                <h3 className="list-title">Still open</h3>
                <p className="muted small-text">
                  Times are in {timeZoneLabel(entry.timezone)} time. First to claim gets it.
                </p>
                <ul className="service-list">
                  {entry.offers.map((o) => (
                    <li key={o.claim_token}>
                      <div className="service-name">
                        {formatDate(o.slot_date)} at {clockTime(o.slot_time)}
                      </div>
                      <Link
                        href={`${bookingLink}/claim?t=${o.claim_token}`}
                        className="button small"
                      >
                        Claim
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="row-links">
              <Link href={bookingLink}>See all open times</Link>
            </div>
            <LeaveWaitlist token={token} />
          </>
        )}
      </section>
    </>
  );
}

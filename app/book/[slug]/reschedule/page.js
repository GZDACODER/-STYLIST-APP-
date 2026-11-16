// Clients land here from "Reschedule" in a confirmation, reminder or
// "moved" email. They pick a new time for the same service.
import Link from "next/link";
import StylistShell from "../StylistShell";
import RescheduleVisit from "./RescheduleVisit";
import { loadVisitByToken } from "@/lib/visitLink";
import { timeZoneLabel } from "@/lib/availability";

export const metadata = { title: "Reschedule Your Visit", robots: { index: false } };

async function ReschedulePageContent({ params, searchParams }) {
  const { slug } = await params;
  const { t: token } = await searchParams;
  const visit = await loadVisitByToken(slug, token);
  const bookingLink = `/book/${slug}`;

  if (!visit) {
    return (
      <section className="card">
        <h2>This link doesn&apos;t work</h2>
        <p className="muted">It may be incomplete. Try tapping the button in your email again.</p>
        <Link href={bookingLink}>Go to the booking page</Link>
      </section>
    );
  }

  const { business_name, timezone } = visit.stylist;

  if (visit.status !== "confirmed" || !visit.upcoming) {
    return (
      <section className="card">
        <h2>This visit can&apos;t be moved</h2>
        <p className="muted">
          {visit.status === "cancelled"
            ? "It was cancelled."
            : "It has already started or passed."}{" "}
          Please contact {business_name} if you need anything.
        </p>
        <Link href={bookingLink} className="button secondary">
          Book another time
        </Link>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Reschedule</h2>
      <RescheduleVisit
        token={token}
        booking={{
          service_name: visit.service_name,
          booking_date: visit.booking_date,
          start_time: visit.start_time,
          end_time: visit.end_time,
        }}
        businessName={business_name}
        zoneNote={`Times are in ${timeZoneLabel(timezone)} time.`}
        bookingLink={bookingLink}
      />
    </section>
  );
}

// The page, next to the stylist's panel (their name and cover photo).
export default async function ReschedulePage(props) {
  const { slug } = await props.params;
  return (
    <StylistShell slug={slug}>
      <ReschedulePageContent {...props} />
    </StylistShell>
  );
}

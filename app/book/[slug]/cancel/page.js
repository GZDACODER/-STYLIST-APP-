// Clients land here from "Cancel this visit" in a confirmation or reminder email.
import Link from "next/link";
import StylistShell from "../StylistShell";
import CancelVisit from "./CancelVisit";
import { loadVisitByToken } from "@/lib/visitLink";
import { clockTime, formatDate, timeZoneLabel } from "@/lib/availability";

export const metadata = { title: "Cancel Your Visit", robots: { index: false } };

async function CancelPageContent({ params, searchParams }) {
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
  const details = (
    <p>
      <strong>{visit.service_name}</strong> with {business_name}
      <br />
      {formatDate(visit.booking_date)}
      <br />
      {clockTime(visit.start_time)} – {clockTime(visit.end_time)}{" "}
      <span className="muted">({timeZoneLabel(timezone)} time)</span>
    </p>
  );

  if (visit.status === "cancelled") {
    return (
      <section className="card">
        <h2>This visit is cancelled</h2>
        {details}
        <Link href={bookingLink} className="button secondary">
          Book another time
        </Link>
      </section>
    );
  }

  if (visit.status !== "confirmed" || !visit.upcoming) {
    return (
      <section className="card">
        <h2>This visit can&apos;t be cancelled here</h2>
        {details}
        <p className="muted">It has already started or passed. Please contact {business_name} directly.</p>
        <Link href={bookingLink}>Go to the booking page</Link>
      </section>
    );
  }

  return (
    <CancelVisit
      token={token}
      details={details}
      businessName={business_name}
      policy={String(visit.cancellation_policy || "").trim()}
      depositPaid={visit.deposit_status === "paid"}
      depositCents={visit.deposit_cents}
      bookingLink={bookingLink}
    />
  );
}

// The page, next to the stylist's panel (their name and cover photo).
export default async function CancelPage(props) {
  const { slug } = await props.params;
  return (
    <StylistShell slug={slug}>
      <CancelPageContent {...props} />
    </StylistShell>
  );
}

// Clients land here from "Pay your deposit" in a standing visit's email.
import Link from "next/link";
import StylistShell from "../StylistShell";
import PayDeposit from "./PayDeposit";
import { loadVisitByToken } from "@/lib/visitLink";
import { clockTime, formatDate, timeZoneLabel } from "@/lib/availability";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Pay Your Deposit", robots: { index: false } };

async function PayPageContent({ params, searchParams }) {
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

  if (visit.status === "confirmed" && visit.deposit_status === "paid") {
    return (
      <section className="card confirmation">
        <h2>Your deposit is paid</h2>
        {details}
        <p className="message success">Deposit paid: {formatPrice(visit.deposit_cents)}</p>
      </section>
    );
  }

  if (visit.status !== "confirmed" || visit.deposit_status !== "unpaid" || !visit.upcoming) {
    return (
      <section className="card">
        <h2>There&apos;s no deposit to pay</h2>
        {details}
        <p className="muted">
          {visit.status === "cancelled"
            ? "This visit was cancelled."
            : `Please contact ${business_name} if you have a question.`}
        </p>
        <Link href={bookingLink}>Go to the booking page</Link>
      </section>
    );
  }

  const balance = visit.price_cents - visit.deposit_cents;
  return (
    <section className="card">
      <h2>Pay your deposit</h2>
      {details}
      <p>
        Deposit: <strong>{formatPrice(visit.deposit_cents)}</strong>
        {balance > 0 && <> · {formatPrice(balance)} left to pay at your appointment</>}
      </p>
      <PayDeposit token={token} label={`Pay ${formatPrice(visit.deposit_cents)} deposit`} />
      <p className="muted small-text">Your visit stays booked either way.</p>
    </section>
  );
}

// The page, next to the stylist's panel (their name and cover photo).
export default async function PayPage(props) {
  const { slug } = await props.params;
  return (
    <StylistShell slug={slug}>
      <PayPageContent {...props} />
    </StylistShell>
  );
}

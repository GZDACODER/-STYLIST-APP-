// Stripe sends the client here after they pay their deposit.
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeCheckoutSession, getStripe } from "@/lib/stripe";
import { clockTime, formatDate, timeZoneLabel } from "@/lib/availability";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Deposit paid" };

async function loadResult(sessionId) {
  if (!sessionId?.startsWith("cs_")) return null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    // The webhook usually confirms the booking first; doing it here too means
    // the client sees "You're booked!" even if the webhook is running late.
    const outcome = await finalizeCheckoutSession(session);

    const { data: booking } = await createAdminClient()
      .from("bookings")
      .select(
        "service_name, booking_date, start_time, end_time, price_cents, deposit_cents, stylist:stylists(business_name, timezone)"
      )
      .eq("id", session.metadata?.booking_id)
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();
    if (!booking) return null;
    return { outcome, booking };
  } catch (error) {
    console.error("Couldn't load paid booking", error);
    return null;
  }
}

export default async function PaidPage({ params, searchParams }) {
  const { slug } = await params;
  const { session_id: sessionId } = await searchParams;
  const result = await loadResult(sessionId);
  const bookingLink = `/book/${slug}`;

  if (!result) {
    return (
      <section className="card">
        <h2>We couldn&apos;t find this payment</h2>
        <p className="muted">
          If you paid, check your email for a receipt from Stripe and contact the salon.
        </p>
        <Link href={bookingLink}>Back to the booking page</Link>
      </section>
    );
  }

  const { outcome, booking } = result;
  const { business_name, timezone } = booking.stylist;
  const balance = booking.price_cents - booking.deposit_cents;

  if (outcome === "refunded") {
    return (
      <section className="card">
        <h2>Sorry, that time was taken</h2>
        <p>
          The time was given to someone else before your payment went through. Your{" "}
          {formatPrice(booking.deposit_cents)} deposit has been refunded. It can take 5 to 10
          days to show on your card.
        </p>
        <Link href={bookingLink} className="button">
          Pick another time
        </Link>
      </section>
    );
  }

  if (outcome === "unpaid") {
    return (
      <section className="card">
        <h2>Payment not finished</h2>
        <p className="muted">Your time isn&apos;t booked yet.</p>
        <Link href={bookingLink} className="button">
          Back to the booking page
        </Link>
      </section>
    );
  }

  return (
    <section className="card confirmation">
      <h2>You&apos;re booked!</h2>
      <p>
        <strong>{booking.service_name}</strong> with {business_name}
        <br />
        {formatDate(booking.booking_date)}
        <br />
        {clockTime(booking.start_time)} – {clockTime(booking.end_time)}
      </p>
      <p className="message success">
        Deposit paid: {formatPrice(booking.deposit_cents)}
        {balance > 0 && <> · {formatPrice(balance)} left to pay at your appointment</>}
      </p>
      <p className="muted small-text">
        Times are in {timeZoneLabel(timezone)} time. To change or
        cancel, please contact {business_name} directly.
      </p>
      <Link href={bookingLink} className="button secondary">
        Book another appointment
      </Link>
    </section>
  );
}

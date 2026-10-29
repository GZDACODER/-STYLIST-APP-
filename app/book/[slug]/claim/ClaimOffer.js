"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { claimOffer } from "../../actions";
import { clockTime, formatDate, timeZoneLabel } from "@/lib/availability";
import { formatPrice } from "@/lib/money";

export default function ClaimOffer({ offer, token, bookingLink, paymentCancelled }) {
  const [state, setState] = useState(offer.state);
  const [error, setError] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [pending, startTransition] = useTransition();

  const policy = offer.cancellation_policy;
  const deposit = offer.deposit_cents;
  const manageLink = `${bookingLink}/waitlist?t=${offer.manage_token}`;
  const when = (
    <p className="summary">
      <strong>{offer.service_name}</strong>
      <br />
      {formatDate(offer.slot_date)}
      <br />
      {clockTime(offer.slot_time)} – {clockTime(offer.end_time)}
      <br />
      <span className="muted small-text">Times are in {timeZoneLabel(offer.timezone)} time.</span>
    </p>
  );

  function claim(event) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await claimOffer(token);
      if (result.error) {
        if (result.code === "slot_unavailable") setState("taken");
        else if (result.code === "already_claimed") setState("claimed");
        else if (result.code === "waitlist_ended") setState("ended");
        else setError(result.error);
        return;
      }
      if (result.checkoutUrl) {
        // Off to Stripe to pay the deposit. The time is held meanwhile.
        setRedirecting(true);
        window.location.assign(result.checkoutUrl);
        return;
      }
      setState("claimed");
    });
  }

  if (state === "claimed") {
    return (
      <section className="card confirmation">
        <h2>You&apos;re booked!</h2>
        {when}
        <p className="muted small-text">
          To cancel, open the booking page and confirm your phone number.
        </p>
        <Link href={bookingLink} className="button secondary">
          Go to the booking page
        </Link>
      </section>
    );
  }

  if (state === "taken") {
    return (
      <section className="card">
        <h2>Sorry, this time was just taken</h2>
        {when}
        <p className="muted">
          Someone else claimed it first. You&apos;re still on the waitlist, so we&apos;ll tell you
          when another time opens up.
        </p>
        <div className="row-links">
          <Link href={manageLink}>See your other open times</Link>
          <Link href={bookingLink}>See all open times</Link>
        </div>
      </section>
    );
  }

  if (state === "ended") {
    return (
      <section className="card">
        <h2>You&apos;re no longer on the waitlist</h2>
        <p className="muted">So this link has stopped working.</p>
        <Link href={bookingLink} className="button secondary">
          See open times
        </Link>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Claim this time</h2>
      {paymentCancelled && (
        <p className="message warning">
          The deposit wasn&apos;t paid, so the time isn&apos;t booked yet. You can try again if
          it&apos;s still free.
        </p>
      )}
      {when}
      <p className="muted">Booking for {offer.client_name}. The first person to claim it gets it.</p>

      <form onSubmit={claim}>
        {policy && (
          <div className="policy">
            <h3>Cancellation policy</h3>
            <p>{policy}</p>
          </div>
        )}
        {deposit > 0 && (
          <p className="message info">
            A {formatPrice(deposit)} deposit is due now to book.
            {offer.price_cents > deposit &&
              ` The other ${formatPrice(offer.price_cents - deposit)} is paid at your appointment.`}{" "}
            You&apos;ll pay securely on Stripe.
          </p>
        )}
        {deposit > 0 && policy && (
          <label className="check-row">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              required
            />
            I&apos;ve read and agree to the cancellation policy
          </label>
        )}
        <button type="submit" className="button" disabled={pending || redirecting}>
          {pending || redirecting
            ? deposit > 0
              ? "Opening payment..."
              : "Booking..."
            : deposit > 0
              ? `Claim and pay ${formatPrice(deposit)} deposit`
              : "Claim this time"}
        </button>
        {error && <p className="message error">{error}</p>}
      </form>
      <div className="row-links">
        <Link href={manageLink}>Other times · Leave the waitlist</Link>
      </div>
    </section>
  );
}

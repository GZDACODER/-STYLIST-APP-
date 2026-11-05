"use client";

// "Cancel this visit?" with Keep it / Yes, cancel. The cancelling itself
// follows the same rules as the booking page.
import { useState, useTransition } from "react";
import Link from "next/link";
import { cancelVisitByToken } from "../../actions";
import { formatPrice } from "@/lib/money";

export default function CancelVisit({
  token,
  details,
  businessName,
  policy,
  depositPaid,
  depositCents,
  bookingLink,
}) {
  const [done, setDone] = useState(false);
  const [kept, setKept] = useState(false);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  function cancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelVisitByToken(token);
      if (result.error) setError(result.error);
      else setDone(true);
    });
  }

  if (done) {
    return (
      <section className="card">
        <h2>Your visit is cancelled</h2>
        {details}
        <p className="muted">{businessName} has been told.</p>
        <Link href={bookingLink} className="button secondary">
          Book another time
        </Link>
      </section>
    );
  }

  if (kept) {
    return (
      <section className="card confirmation">
        <h2>See you then!</h2>
        {details}
        <p className="muted">Your visit is still booked.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2>Cancel this visit?</h2>
      {details}
      {depositPaid && (
        <p className="cancel-note">
          Your {formatPrice(depositCents)} deposit isn&apos;t refunded automatically;{" "}
          {businessName}&apos;s cancellation policy decides.
        </p>
      )}
      {policy && (
        <p className="muted small-text">
          <strong>Cancellation policy:</strong> {policy}
        </p>
      )}
      <div className="row">
        <button type="button" className="button" onClick={() => setKept(true)} disabled={pending}>
          Keep my visit
        </button>
        <button type="button" className="button secondary" onClick={cancel} disabled={pending}>
          {pending ? "Cancelling..." : "Yes, cancel"}
        </button>
      </div>
      {error && <p className="message error">{error}</p>}
    </section>
  );
}

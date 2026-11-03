"use client";

import { useEffect, useState, useTransition } from "react";
import { cancelMyBooking, getMyBookings } from "../actions";
import { clockTime, formatDate } from "@/lib/availability";
import { formatPrice } from "@/lib/money";

// "Thu, Nov 12" (the year only when it isn't this year).
function shortDate(text) {
  const [y, m, d] = text.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  return day.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(y !== new Date().getFullYear() && { year: "numeric" }),
  });
}

// A confirmed client's upcoming appointments here, with a Cancel link.
// Cancel asks first ("Keep appointment" / "Yes, cancel"); the cancelling
// itself and the deposit rules are unchanged.
// refreshKey: changes when the list should be loaded again.
export default function MyBookings({ slug, businessName, policy, refreshKey, onCancelled }) {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);
  // The booking whose "Cancel?" question is showing.
  const [confirmingId, setConfirmingId] = useState(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let ignore = false;
    getMyBookings(slug).then((result) => {
      if (!ignore) setBookings(result.bookings || []);
    });
    return () => {
      ignore = true;
    };
  }, [slug, refreshKey]);

  if (bookings.length === 0) return null;

  function askToCancel(booking) {
    setError(null);
    setConfirmingId(booking.id);
  }

  function cancel(booking) {
    setError(null);
    startTransition(async () => {
      const result = await cancelMyBooking(slug, booking.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setConfirmingId(null);
      const fresh = await getMyBookings(slug);
      setBookings(fresh.bookings || []);
      onCancelled?.();
    });
  }

  return (
    <section className="card">
      <h2>Your upcoming appointments</h2>
      <ul className="service-list">
        {bookings.map((b) =>
          b.id === confirmingId ? (
            <li key={b.id} className="confirming">
              <div className="cancel-confirm" role="group" aria-label="Cancel this appointment?">
                <p>
                  Cancel your {b.service_name} on {shortDate(b.booking_date)} at{" "}
                  {clockTime(b.start_time)}?
                </p>
                {b.deposit_status === "paid" && (
                  <p className="cancel-note">
                    Your {formatPrice(b.deposit_cents)} deposit isn&apos;t refunded automatically;{" "}
                    {businessName}&apos;s cancellation policy decides.
                  </p>
                )}
                <div className="cancel-actions">
                  <button
                    type="button"
                    className="button small"
                    onClick={() => setConfirmingId(null)}
                    disabled={pending}
                    autoFocus
                  >
                    Keep appointment
                  </button>
                  <button
                    type="button"
                    className="button secondary small"
                    onClick={() => cancel(b)}
                    disabled={pending}
                  >
                    {pending ? "Cancelling..." : "Yes, cancel"}
                  </button>
                </div>
              </div>
            </li>
          ) : (
            <li key={b.id}>
              <div>
                <div className="service-name">{b.service_name}</div>
                <div className="muted">
                  {formatDate(b.booking_date)} · {clockTime(b.start_time)} – {clockTime(b.end_time)}
                </div>
              </div>
              <button
                type="button"
                className="link-button cancel-link"
                onClick={() => askToCancel(b)}
                disabled={pending}
                aria-label={`Cancel ${b.service_name} on ${formatDate(b.booking_date)}`}
              >
                Cancel
              </button>
            </li>
          )
        )}
      </ul>
      {policy && <p className="muted small-text">Cancellation policy: {policy}</p>}
      {error && <p className="message error">{error}</p>}
    </section>
  );
}

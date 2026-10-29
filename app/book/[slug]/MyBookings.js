"use client";

import { useEffect, useState, useTransition } from "react";
import { cancelMyBooking, getMyBookings } from "../actions";
import { clockTime, formatDate } from "@/lib/availability";
import { formatPrice } from "@/lib/money";

// A confirmed client's upcoming appointments here, with a Cancel button.
// refreshKey: changes when the list should be loaded again.
export default function MyBookings({ slug, businessName, policy, refreshKey, onCancelled }) {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);
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

  function cancel(booking) {
    const depositNote =
      booking.deposit_status === "paid"
        ? ` Your ${formatPrice(booking.deposit_cents)} deposit isn't refunded automatically; ${businessName}'s cancellation policy decides.`
        : "";
    const ok = window.confirm(
      `Cancel your ${booking.service_name} on ${formatDate(booking.booking_date)} at ${clockTime(
        booking.start_time
      )}?${depositNote}`
    );
    if (!ok) return;

    setError(null);
    startTransition(async () => {
      const result = await cancelMyBooking(slug, booking.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      const fresh = await getMyBookings(slug);
      setBookings(fresh.bookings || []);
      onCancelled?.();
    });
  }

  return (
    <section className="card">
      <h2>Your upcoming appointments</h2>
      <ul className="service-list">
        {bookings.map((b) => (
          <li key={b.id}>
            <div>
              <div className="service-name">{b.service_name}</div>
              <div className="muted">
                {formatDate(b.booking_date)} · {clockTime(b.start_time)} – {clockTime(b.end_time)}
              </div>
            </div>
            <button
              type="button"
              className="link-button danger"
              onClick={() => cancel(b)}
              disabled={pending}
            >
              Cancel
            </button>
          </li>
        ))}
      </ul>
      {policy && <p className="muted small-text">Cancellation policy: {policy}</p>}
      {error && <p className="message error">{error}</p>}
    </section>
  );
}

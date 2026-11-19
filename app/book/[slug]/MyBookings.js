"use client";

import { useEffect, useState, useTransition } from "react";
import { cancelMyBooking, getMyBookings, getMyRescheduleSlots, rescheduleMyBooking } from "../actions";
import ReschedulePicker from "./ReschedulePicker";
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

// A confirmed client's upcoming appointments here, with Reschedule and
// Cancel. Reschedule opens a time picker for the same service; when a
// booking can't be moved online (too close to the time, or moved twice
// already) it says to contact the business instead.
// Cancel asks first ("Keep appointment" / "Yes, cancel"); the cancelling
// itself and the deposit rules are unchanged.
// refreshKey: changes when the list should be loaded again.
export default function MyBookings({ slug, businessName, policy, zoneNote, refreshKey, onCancelled }) {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState(null);
  // The booking whose "Cancel?" question is showing.
  const [confirmingId, setConfirmingId] = useState(null);
  // The booking being moved to another time.
  const [movingId, setMovingId] = useState(null);
  const [pending, startTransition] = useTransition();
  // "Cancelled: ..." after a cancel, so it's clear it worked (even when it
  // was their only appointment and the list is now empty).
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let ignore = false;
    getMyBookings(slug).then((result) => {
      if (!ignore) setBookings(result.bookings || []);
    });
    return () => {
      ignore = true;
    };
  }, [slug, refreshKey]);

  if (bookings.length === 0) {
    return notice ? (
      <p className="message success" role="status">
        {notice}
      </p>
    ) : null;
  }

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
      setNotice(`Cancelled: your ${booking.service_name} on ${shortDate(booking.booking_date)} at ${clockTime(booking.start_time)}. ${businessName} has been told.`);
      const fresh = await getMyBookings(slug);
      setBookings(fresh.bookings || []);
      onCancelled?.();
    });
  }

  return (
    <section className="card">
      <h2>Your upcoming appointments</h2>
      {notice && (
        <p className="message success" role="status">
          {notice}
        </p>
      )}
      <ul className="service-list">
        {bookings.map((b) =>
          b.id === movingId ? (
            <li key={b.id} className="confirming">
              <ReschedulePicker
                booking={b}
                businessName={businessName}
                zoneNote={zoneNote}
                loadSlots={() => getMyRescheduleSlots(slug, b.id)}
                move={(date, time) => rescheduleMyBooking(slug, b.id, date, time)}
                onDone={() => onCancelled?.()}
                onClose={async () => {
                  setMovingId(null);
                  const fresh = await getMyBookings(slug);
                  setBookings(fresh.bookings || []);
                }}
              />
            </li>
          ) : b.id === confirmingId ? (
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
                {b.can_reschedule === false && (
                  <div className="muted small-text">
                    {b.reschedule_reason === "too_many"
                      ? "Moved twice already. "
                      : "Too close to the time to move online. "}
                    Contact {businessName} to change this booking.
                  </div>
                )}
              </div>
              <span className="my-booking-actions">
              {b.can_reschedule === true && (
                <button
                  type="button"
                  className="link-button cancel-link"
                  onClick={() => {
                    setError(null);
                    setConfirmingId(null);
                    setMovingId(b.id);
                  }}
                  disabled={pending}
                  aria-label={`Reschedule ${b.service_name} on ${formatDate(b.booking_date)}`}
                >
                  Reschedule
                </button>
              )}
              <button
                type="button"
                className="link-button cancel-link"
                onClick={() => askToCancel(b)}
                disabled={pending}
                aria-label={`Cancel ${b.service_name} on ${formatDate(b.booking_date)}`}
              >
                Cancel
              </button>
              </span>
            </li>
          )
        )}
      </ul>
      {policy && <p className="muted small-text">Cancellation policy: {policy}</p>}
      {error && <p className="message error">{error}</p>}
    </section>
  );
}

"use client";

import { useState } from "react";
import { cancelBooking } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import { clockTime } from "@/lib/availability";

// "Thu, Nov 12" (the year only when it isn't this year).
function shortDate(text) {
  const [y, m, d] = String(text).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(y !== new Date().getFullYear() && { year: "numeric" }),
  });
}

// "Cancel booking" asks first, on the page (not a pop-up):
// "Cancel Taura's Hair cut on Thu, Nov 12 at 9:00 AM?" with Keep booking /
// Yes, cancel. Cancelling itself is unchanged.
export default function CancelBookingButton({
  id,
  clientName,
  serviceName,
  date,
  startTime,
  depositPaid,
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className="link-button danger" onClick={() => setAsking(true)}>
        Cancel booking
      </button>
    );
  }

  return (
    <form action={cancelBooking} className="cancel-confirm" aria-label="Cancel this booking?">
      <input type="hidden" name="id" value={id} />
      <p className="cancel-question">
        Cancel {clientName}&apos;s {serviceName} on {shortDate(date)} at {clockTime(startTime)}?
      </p>
      <p className="muted small-text">
        The time opens up again, and anyone on your waitlist who wants it is emailed.{" "}
        {clientName} isn&apos;t told automatically, so let them know.
        {depositPaid &&
          " Their deposit isn't refunded automatically. If your policy says to refund it, do that in Stripe."}
      </p>
      <div className="cancel-actions">
        <button type="button" className="button small" onClick={() => setAsking(false)} autoFocus>
          Keep booking
        </button>
        <SubmitButton className="button secondary small" pendingText="Cancelling...">
          Yes, cancel
        </SubmitButton>
      </div>
    </form>
  );
}

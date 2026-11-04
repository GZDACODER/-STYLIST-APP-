"use client";

import { cancelBooking } from "./actions";
import ConfirmAction from "@/components/ConfirmAction";
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

// "Cancel booking" asks first: "Cancel Taura's Hair cut on Thu, Nov 12 at
// 9:00 AM?" with Keep booking / Yes, cancel. Cancelling itself is unchanged.
export default function CancelBookingButton({
  id,
  clientName,
  serviceName,
  date,
  startTime,
  depositPaid,
}) {
  return (
    <ConfirmAction
      label="Cancel booking"
      question={`Cancel ${clientName}'s ${serviceName} on ${shortDate(date)} at ${clockTime(startTime)}?`}
      note={
        `The time opens up again, and anyone on your waitlist who wants it is emailed. ${clientName} isn't told automatically, so let them know.` +
        (depositPaid
          ? " Their deposit isn't refunded automatically. If your policy says to refund it, do that in Stripe."
          : "")
      }
      keepLabel="Keep booking"
      confirmLabel="Yes, cancel"
      pendingText="Cancelling..."
      action={cancelBooking}
      fields={{ id }}
    />
  );
}

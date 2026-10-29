"use client";

import { cancelBooking } from "./actions";
import SubmitButton from "@/components/SubmitButton";

export default function CancelBookingButton({ id, clientName, depositPaid }) {
  function confirmCancel(event) {
    const refundNote = depositPaid
      ? " Their deposit isn't refunded automatically. If your policy says to refund it, do that in Stripe."
      : "";
    const ok = window.confirm(
      `Cancel ${clientName}'s booking? The time opens up again, and anyone on your waitlist who wants it is emailed. ${clientName} isn't told automatically, so let them know.${refundNote}`
    );
    if (!ok) event.preventDefault();
  }

  return (
    <form action={cancelBooking} onSubmit={confirmCancel}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="link-button danger" pendingText="Cancelling...">
        Cancel booking
      </SubmitButton>
    </form>
  );
}

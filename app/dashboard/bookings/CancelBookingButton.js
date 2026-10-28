"use client";

import { cancelBooking } from "./actions";
import SubmitButton from "@/components/SubmitButton";

export default function CancelBookingButton({ id, clientName }) {
  function confirmCancel(event) {
    const ok = window.confirm(
      `Cancel ${clientName}'s booking? The time opens up again. ${clientName} isn't told automatically, so let them know.`
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

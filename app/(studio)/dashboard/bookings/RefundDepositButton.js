"use client";

// "Refund deposit": asks first ("Refund Taura's $20.00 deposit?"), then
// refunds it on Stripe and says how it went.
import { useActionState, useState } from "react";
import { refundBookingDeposit } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import { formatPrice } from "@/lib/money";
import { depositFeeCents } from "@/lib/plans";

// stillBooked: the booking stays on the calendar (only the deposit goes back).
export default function RefundDepositButton({ id, clientName, depositCents, stillBooked = false }) {
  const [asking, setAsking] = useState(false);
  const [state, formAction] = useActionState(refundBookingDeposit, null);
  const amount = formatPrice(depositCents);
  const fee = formatPrice(depositFeeCents(depositCents));

  if (state?.success) return <p className="message success small-text">{state.success}</p>;

  if (!asking) {
    return (
      <button type="button" className="link-button quiet-link" onClick={() => setAsking(true)}>
        Refund deposit
      </button>
    );
  }

  return (
    <form action={formAction} className="confirm-step" aria-label={`Refund ${clientName}'s deposit`}>
      <input type="hidden" name="id" value={id} />
      <p className="confirm-question">
        Refund {clientName}&apos;s {amount} deposit?
      </p>
      <p className="muted small-text">
        The whole {amount} goes back to their card (5 to 10 business days), and comes out of your
        Stripe balance. Clientele&apos;s {fee} fee isn&apos;t returned.
        {stillBooked ? " The appointment stays booked." : ""} If they gave an email, they&apos;re emailed to let them know.
      </p>
      <div className="confirm-actions">
        <button type="button" className="button small" onClick={() => setAsking(false)} autoFocus>
          Keep deposit
        </button>
        <SubmitButton className="button small confirm-danger" pendingText="Refunding...">
          Yes, refund {amount}
        </SubmitButton>
      </div>
      {state?.error && <p className="message error small-text">{state.error}</p>}
    </form>
  );
}

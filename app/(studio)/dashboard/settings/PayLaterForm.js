"use client";

// Settings → Deposits → Pay over time: let clients split deposits and
// payment links of $50 or more with Klarna, Afterpay or Affirm (lib/payLater.js).
import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { savePayLater } from "./payLaterActions";

export default function PayLaterForm({ on, live, stripeReady }) {
  const [state, action] = useActionState(savePayLater, null);
  return (
    <form action={action} className="stack">
      <label className="check-row">
        <input type="checkbox" name="pay_later" defaultChecked={on} disabled={!stripeReady} />
        <span>
          <strong>Let clients pay over time</strong> on deposits and payment links of $50 or more, with Klarna, Afterpay or
          Affirm.
        </span>
      </label>
      <p className="muted small-text">
        You&apos;re paid in full right away; the client pays them back in installments. Those payments cost more to take, so the
        fee on them is 6% + 30¢ instead of 3% + 30¢. Card, Apple Pay and Google Pay payments don&apos;t change.
      </p>
      {!stripeReady && <p className="message info">Connect Stripe above first.</p>}
      {stripeReady && !live && (
        <p className="message info">Pay over time is being switched on with Stripe. Your choice applies as soon as it&apos;s live.</p>
      )}
      <SubmitButton className="button secondary small" pendingText="Saving..." disabled={!stripeReady}>
        Save
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

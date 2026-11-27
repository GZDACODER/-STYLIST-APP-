"use client";

// Money → Payment links → New payment link: an amount, what it's for and
// (optionally) who. Once made, it's shared right here.
import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { createPaymentLink } from "./linkActions";
import LinkShare from "./LinkShare";

export default function PaymentLinkForm({ canTakePayments, example = "Balance for silk press" }) {
  const [state, action] = useActionState(createPaymentLink, null);
  if (!canTakePayments) {
    return (
      <p className="message info">
        To send payment links, connect Stripe first in <a href="/dashboard/settings/deposits">Settings → Deposits</a>. Payments go
        straight to your own Stripe account.
      </p>
    );
  }
  if (state?.link) {
    return (
      <div className="pl-made">
        <p className="message success">{state.success}</p>
        <p className="pl-url">{state.link.url}</p>
        <div className="row">
          <LinkShare url={state.link.url} message={state.link.message} businessName={state.link.businessName} primary />
          <a href="/dashboard/money?tab=links" className="button small secondary">
            Make another
          </a>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="mn-grid pl-form">
      <label>
        Amount ($)
        <input name="amount" inputMode="decimal" placeholder="60" required />
      </label>
      <label>
        What it&apos;s for
        <input name="description" maxLength={120} placeholder={`e.g. ${example}`} required />
      </label>
      <label>
        Client name (optional)
        <input name="client_name" maxLength={100} placeholder="Shown on the payment page" />
      </label>
      <p className="muted small-text">Clients pay by card, Apple Pay, Google Pay or Cash App. It goes to your Stripe account, minus 3% + 30¢.</p>
      <SubmitButton className="button" pendingText="Making the link...">
        Make payment link
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { buyGiftCard } from "./actions";

export default function GiftForm({ slug, amounts }) {
  const [state, action, pending] = useActionState(buyGiftCard, null);
  const [amount, setAmount] = useState(String(amounts[1] || amounts[0]));
  return (
    <form action={action} className="gc-form">
      <input type="hidden" name="slug" value={slug} />
      <fieldset>
        <legend>Amount</legend>
        <div className="pp-chips">
          {amounts.map((c) => (
            <label key={c} className="pp-chip">
              <input type="radio" name="amount" value={c} checked={amount === String(c)} onChange={() => setAmount(String(c))} />
              <span>${c / 100}</span>
            </label>
          ))}
          <label className="pp-chip">
            <input type="radio" name="amount" value="custom" checked={amount === "custom"} onChange={() => setAmount("custom")} />
            <span>Other</span>
          </label>
        </div>
        {amount === "custom" && (
          <label>
            Amount ($10 to $1,000)
            <input name="custom" inputMode="decimal" placeholder="$" required />
          </label>
        )}
      </fieldset>
      <label>
        Who&apos;s it for?
        <input name="recipient_name" maxLength={100} required placeholder="Their name" />
      </label>
      <label>
        Their email (optional)
        <input name="recipient_email" type="email" maxLength={200} placeholder="We'll email it to them" />
      </label>
      <label>
        A message (optional)
        <textarea name="message" rows={3} maxLength={300} placeholder="Happy birthday! Treat yourself." />
      </label>
      <label>
        Your name
        <input name="buyer_name" autoComplete="name" maxLength={100} required />
      </label>
      <label>
        Your email
        <input name="buyer_email" type="email" autoComplete="email" maxLength={200} required />
      </label>
      <p className="muted small-text">No email for them? We&apos;ll send the gift card to you to pass on.</p>
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Opening payment..." : "Continue to payment"}
      </button>
      {state?.error && <p className="message error">{state.error}</p>}
    </form>
  );
}

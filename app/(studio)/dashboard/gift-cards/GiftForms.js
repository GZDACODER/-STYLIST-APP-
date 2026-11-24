"use client";

import { useActionState, useEffect, useRef } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { redeemGift, setGiftCards } from "./actions";

export function GiftSwitch({ on, ready }) {
  const [state, action] = useActionState(setGiftCards, null);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="on" value={on ? "false" : "true"} />
      <SubmitButton className={on ? "button small secondary" : "button small"} pendingText="Saving..." disabled={!on && !ready}>
        {on ? "Stop selling gift cards" : "Start selling gift cards"}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function RedeemForm({ notePlaceholder }) {
  const [state, action] = useActionState(redeemGift, null);
  const form = useRef(null);
  useEffect(() => {
    if (state?.at) form.current?.reset();
  }, [state?.at]);
  return (
    <form action={action} ref={form} className="stack">
      <div className="mn-grid">
        <label>
          Code
          <input name="code" placeholder="GIFT-AB2C-DE3F" autoCapitalize="characters" autoCorrect="off" required />
        </label>
        <label>
          Amount to take off
          <input name="amount" inputMode="decimal" placeholder="$0.00" required />
        </label>
      </div>
      <label>
        Note (optional)
        <input name="note" maxLength={200} placeholder={notePlaceholder} />
      </label>
      <SubmitButton pendingText="Redeeming...">Redeem</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

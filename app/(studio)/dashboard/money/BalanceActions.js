"use client";

import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { METHODS } from "@/lib/moneyTab";
import { markBalancePaid, remindBalance } from "./actions";

export default function BalanceActions({ id, owedCents, canEmail }) {
  const [paying, setPaying] = useState(false);
  const [pState, pay] = useActionState(markBalancePaid, null);
  const [rState, remind] = useActionState(remindBalance, null);
  if (pState?.success) return <FormMessage state={pState} />;
  return (
    <div className="rq-actions">
      {paying ? (
        <form action={pay} className="mn-grid">
          <input type="hidden" name="id" value={id} />
          <label>
            Amount paid
            <input name="amount" inputMode="decimal" defaultValue={(owedCents / 100).toFixed(2)} required />
          </label>
          <label>
            Paid by
            <select name="method" defaultValue="cash">
              {METHODS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <SubmitButton className="button small" pendingText="Saving...">
              Save
            </SubmitButton>
            <button type="button" className="link-button small-text" onClick={() => setPaying(false)}>
              Back
            </button>
          </div>
          <FormMessage state={pState} />
        </form>
      ) : (
        <div className="row">
          <button type="button" className="button small" onClick={() => setPaying(true)}>
            Mark paid
          </button>
          {canEmail && (
            <form action={remind}>
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="owed" value={owedCents / 100} />
              <SubmitButton className="button small secondary" pendingText="Sending...">
                Send a reminder
              </SubmitButton>
            </form>
          )}
        </div>
      )}
      <FormMessage state={rState} />
    </div>
  );
}

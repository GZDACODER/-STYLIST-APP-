"use client";

import { useActionState, useEffect, useRef } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { KINDS, METHODS } from "@/lib/moneyTab";
import { addPayment } from "./actions";

export default function RecordPayment({ clients, today }) {
  const [state, action] = useActionState(addPayment, null);
  const form = useRef(null);
  useEffect(() => {
    if (state?.savedAt) form.current?.reset();
  }, [state?.savedAt]);
  return (
    <form action={action} ref={form} className="stack mn-form">
      <div className="mn-grid">
        <label>
          Amount
          <input name="amount" inputMode="decimal" placeholder="$0.00" required />
        </label>
        <label>
          For
          <select name="kind" defaultValue="tip">
            {KINDS.filter(([k]) => k !== "balance").map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
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
        <label>
          Date
          <input name="paid_on" type="date" defaultValue={today} max={today} />
        </label>
      </div>
      <label>
        Client (optional)
        <select name="client_id" defaultValue="">
          <option value="">No one in particular</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Note (optional)
        <input name="note" maxLength={300} placeholder="e.g. Edge control, 2 jars" />
      </label>
      <SubmitButton pendingText="Saving...">Save payment</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

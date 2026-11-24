"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { METHODS } from "@/lib/moneyTab";
import { sellPackage } from "./actions";

export default function SellForm({ clients, services, presets, words }) {
  const [state, action] = useActionState(sellPackage, null);
  const [name, setName] = useState(presets[0]?.name || "");
  const [sessions, setSessions] = useState(presets[0]?.sessions || 10);
  const form = useRef(null);
  useEffect(() => {
    if (state?.at) form.current?.reset();
  }, [state?.at]);
  return (
    <form action={action} ref={form} className="stack">
      {presets.length > 0 && (
        <div className="row wrap">
          {presets.map((p) => (
            <button key={p.name} type="button" className="button small secondary" onClick={() => (setName(p.name), setSessions(p.sessions))}>
              {p.name}
            </button>
          ))}
        </div>
      )}
      <label>
        For
        <select name="client_id" defaultValue="" required>
          <option value="" disabled>
            Choose {words.aClient}
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="mn-grid">
        <label>
          Package
          <input name="name" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          {words.Appointments}
          <input name="sessions" type="number" min={1} max={200} value={sessions} onChange={(e) => setSessions(e.target.value)} required />
        </label>
        <label>
          Price paid
          <input name="price" inputMode="decimal" placeholder="$0.00" />
        </label>
        <label>
          Paid by
          <select name="method" defaultValue="">
            <option value="">Not paid yet</option>
            {METHODS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mn-grid">
        <label>
          Only for (optional)
          <select name="service_id" defaultValue="">
            <option value="">Any {words.service}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Expires (optional)
          <input name="expires_on" type="date" />
        </label>
      </div>
      <SubmitButton pendingText="Saving...">Sell package</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

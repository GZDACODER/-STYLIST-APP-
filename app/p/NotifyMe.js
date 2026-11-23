"use client";

// "Notify me": follow a pro and get an email when new times open (step 60).
import { useActionState, useState } from "react";
import { confirmFollow, followPro } from "./actions";

const DAYS = [[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]];
const PARTS = [["morning", "Mornings"], ["afternoon", "Afternoons"], ["evening", "Evenings"]];

export default function NotifyMe({ handle, name, services, words, primary = false }) {
  const [open, setOpen] = useState(false);
  const [wants, setWants] = useState("any");
  const [state, follow, pending] = useActionState(followPro, null);
  const [cState, confirm, cPending] = useActionState(confirmFollow, null);
  const done = state?.done || cState?.done;

  if (done)
    return (
      <p className="message success pp-notify-done">
        You&apos;re on the list. We&apos;ll email you when {name} has openings that match. Every email has a one-tap
        unsubscribe link.
      </p>
    );
  if (!open)
    return (
      <button type="button" className={primary ? "button" : "button secondary"} onClick={() => setOpen(true)}>
        Notify me of openings
      </button>
    );

  if (state?.step === "code" || cState?.step === "code") {
    const id = cState?.id || state?.id;
    return (
      <form action={confirm} className="pp-notify">
        <input type="hidden" name="handle" value={handle} />
        <input type="hidden" name="id" value={id} />
        <p className="small-text">
          We emailed a 6-digit code to <strong>{state?.email || cState?.email}</strong>. Enter it to confirm. You only do
          this once.
        </p>
        <label>
          Code
          <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} required />
        </label>
        <button type="submit" className="button" disabled={cPending}>
          {cPending ? "Checking..." : "Confirm"}
        </button>
        {cState?.error && <p className="message error">{cState.error}</p>}
      </form>
    );
  }

  return (
    <form action={follow} className="pp-notify">
      <input type="hidden" name="handle" value={handle} />
      <p className="small-text">Get an email when {name} opens new times. Regulars hear first.</p>
      <fieldset>
        <legend className="small-text">Tell me about</legend>
        {[
          ["any", "Any opening"],
          ["times", "Certain days or times"],
          ["services", `Certain ${words.services}`],
        ].map(([k, label]) => (
          <label key={k} className="pp-radio">
            <input type="radio" name="wants" value={k} checked={wants === k} onChange={() => setWants(k)} /> {label}
          </label>
        ))}
      </fieldset>
      {wants === "times" && (
        <div className="pp-chips">
          {DAYS.map(([v, l]) => (
            <label key={v} className="pp-chip">
              <input type="checkbox" name="days" value={v} />
              <span>{l}</span>
            </label>
          ))}
          {PARTS.map(([v, l]) => (
            <label key={v} className="pp-chip">
              <input type="checkbox" name="parts" value={v} />
              <span>{l}</span>
            </label>
          ))}
        </div>
      )}
      {wants === "services" && (
        <div className="pp-chips">
          {services.map((s) => (
            <label key={s.id} className="pp-chip">
              <input type="checkbox" name="services" value={s.id} />
              <span>{s.name}</span>
            </label>
          ))}
        </div>
      )}
      <label>
        Your name
        <input name="name" autoComplete="name" maxLength={100} required />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" maxLength={200} required />
      </label>
      <label>
        Mobile (optional, for text alerts later)
        <input name="phone" type="tel" autoComplete="tel" maxLength={40} />
      </label>
      <div className="pp-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving..." : "Notify me"}
        </button>
        <button type="button" className="pp-report-link" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {state?.error && <p className="message error">{state.error}</p>}
    </form>
  );
}

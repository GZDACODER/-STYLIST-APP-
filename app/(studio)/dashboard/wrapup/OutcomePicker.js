"use client";

// The four choices under a visit on Wrap up visits. Shows the choice
// straight away while it saves.
import { useOptimistic, useState, startTransition } from "react";
import { setVisitOutcome } from "./actions";
import { OUTCOMES } from "@/lib/outcomes";

export default function OutcomePicker({ bookingId, outcome, clientName }) {
  const [current, setCurrent] = useOptimistic(outcome);
  const [error, setError] = useState(null);

  function pick(value) {
    const next = value === current ? null : value;
    setError(null);
    startTransition(async () => {
      setCurrent(next);
      const result = await setVisitOutcome(bookingId, next);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <>
      <div className="outcome-choices" role="group" aria-label={`How did ${clientName}'s visit go?`}>
        {OUTCOMES.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`outcome-choice ${o.value}${current === o.value ? " checked" : ""}`}
            aria-pressed={current === o.value}
            onClick={() => pick(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className="message error">{error}</p>}
    </>
  );
}

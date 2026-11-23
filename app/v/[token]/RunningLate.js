"use client";

import { useState, useTransition } from "react";
import { runningLateByLink } from "../actions";

export default function RunningLate({ token }) {
  const [sent, setSent] = useState(null);
  const [error, setError] = useState(null);
  const [pending, start] = useTransition();
  return (
    <div className="mv-late">
      <p className="mv-label">Running late?</p>
      <div className="mv-late-buttons">
        {[5, 10, 15].map((m) => (
          <button
            key={m}
            type="button"
            className="chip"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await runningLateByLink(token, m);
                if (r.error) setError(r.error);
                else setSent(m);
              })
            }
          >
            {m === 15 ? "15+ min" : `${m} min`}
          </button>
        ))}
      </div>
      {sent && (
        <p className="message success small-text" role="status">
          Sent. They know you&apos;re about {sent === 15 ? "15+" : sent} minutes away.
        </p>
      )}
      {error && <p className="message error small-text">{error}</p>}
    </div>
  );
}

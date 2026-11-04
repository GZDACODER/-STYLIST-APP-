"use client";

import { useState } from "react";
import SubmitButton from "@/components/SubmitButton";

// A quiet link ("Cancel booking", "Delete client") that asks first, on the
// page: the question, an optional note, then "Keep ..." (black, the safe
// choice) and the final "Yes, ..." button (the only muted red).
// action: the server action, called with a form holding `fields`.
export default function ConfirmAction({
  label,
  question,
  note,
  keepLabel,
  confirmLabel,
  pendingText,
  action,
  fields = {},
}) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <button type="button" className="link-button quiet-link" onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }

  return (
    <form action={action} className="confirm-step" aria-label={question}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <p className="confirm-question">{question}</p>
      {note && <p className="muted small-text">{note}</p>}
      <div className="confirm-actions">
        <button type="button" className="button small" onClick={() => setAsking(false)} autoFocus>
          {keepLabel}
        </button>
        <SubmitButton className="button small confirm-danger" pendingText={pendingText}>
          {confirmLabel}
        </SubmitButton>
      </div>
    </form>
  );
}

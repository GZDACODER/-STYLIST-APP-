"use client";

// A visit's note (and the amount still owed, when it's "Balance owed").
// Shows the note with "Edit note", or "Add a note" when there's none yet;
// tapping opens a small form. Used on the Notes tab and Wrap up visits.
import { useState, useTransition } from "react";
import { setVisitNote } from "./actions";
import { formatPrice } from "@/lib/money";

const dollars = (cents) => (cents == null ? "" : (cents / 100).toFixed(2).replace(/\.00$/, ""));

export default function VisitNoteForm({ bookingId, note, owedCents, owed }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note || "");
  const [amount, setAmount] = useState(dollars(owedCents));
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  function open() {
    setText(note || "");
    setAmount(dollars(owedCents));
    setError(null);
    setEditing(true);
  }

  function save(e) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await setVisitNote(bookingId, text, owed ? amount : dollars(owedCents));
      if (result?.error) setError(result.error);
      else setEditing(false);
    });
  }

  if (!editing) {
    return (
      <div className="visit-note">
        {owed && owedCents != null && (
          <p className="visit-note-owed">
            <span className="badge unpaid">{formatPrice(owedCents)} owed</span>
          </p>
        )}
        {note && <p className="visit-note-text">{note}</p>}
        <button type="button" className="link-button quiet-link" onClick={open}>
          {note || (owed && owedCents != null)
            ? "Edit note"
            : owed
              ? "Add a note or amount owed"
              : "Add a note"}
        </button>
      </div>
    );
  }

  return (
    <form className="visit-note-form" onSubmit={save}>
      <label>
        Note
        <textarea
          rows={3}
          maxLength={1000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. 6N color, 20 vol · wants a trim next time"
          autoFocus
        />
      </label>
      {owed && (
        <label>
          Amount still owed ($)
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 40"
          />
        </label>
      )}
      <div className="confirm-actions">
        <button type="button" className="button small secondary" onClick={() => setEditing(false)} disabled={pending}>
          Cancel
        </button>
        <button type="submit" className="button small" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </button>
      </div>
      {error && <p className="message error">{error}</p>}
    </form>
  );
}

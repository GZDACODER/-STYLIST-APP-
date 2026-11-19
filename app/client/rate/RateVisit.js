"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { feedbackByToken } from "../actions";

export default function RateVisit({ token, initial }) {
  const [rating, setRating] = useState(initial || 0);
  const [comment, setComment] = useState("");
  const [saved, setSaved] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();
  const once = useRef(false);

  const save = (r, c) =>
    startTransition(async () => {
      setError(null);
      const res = await feedbackByToken(token, r, c);
      if (res.error) setError(res.error);
      else if (c !== undefined) setDone(true);
      else setSaved(true);
    });

  // The star tapped in the email counts straight away.
  useEffect(() => {
    if (initial && !once.current) {
      once.current = true;
      save(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (done) return <p className="message success">Thank you. Only your pro sees this.</p>;
  return (
    <section className="card">
      <p className="muted">{saved ? "Saved. Only your pro sees this." : "How was it? Only your pro sees this."}</p>
      <div className="cl-stars" role="group" aria-label="Rate your visit">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={n <= rating ? "cl-star on" : "cl-star"}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            aria-pressed={n === rating}
            onClick={() => {
              setRating(n);
              save(n);
            }}
          >
            ★
          </button>
        ))}
      </div>
      {rating > 0 && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            save(rating, comment);
          }}
        >
          <label>
            Anything to add? (optional)
            <textarea rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <button type="submit" className="button" disabled={pending}>
            {pending ? "Sending..." : "Send"}
          </button>
        </form>
      )}
      {error && <p className="message error">{error}</p>}
    </section>
  );
}

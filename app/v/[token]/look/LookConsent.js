"use client";

import { useState, useTransition } from "react";
import { lookConsentByLink } from "../../actions";

export default function LookConsent({ token, initial, proName }) {
  const [answer, setAnswer] = useState(initial);
  const [error, setError] = useState(null);
  const [pending, start] = useTransition();
  const choose = (yes) =>
    start(async () => {
      setError(null);
      const r = await lookConsentByLink(token, yes);
      if (r.error) setError(r.error);
      else setAnswer(r.yes ? "yes" : "no");
    });
  return (
    <>
      {answer === "yes" && (
        <p className="message success">
          Thank you! {proName} may show this photo on their public profile. You can change your mind here any time.
        </p>
      )}
      {answer === "no" && <p className="message info">Got it. This photo stays private between you and {proName}.</p>}
      <div className="pp-actions lk-actions">
        <button type="button" className={answer === "yes" ? "button secondary" : "button"} disabled={pending || answer === "yes"} onClick={() => choose(true)}>
          {answer === "yes" ? "Shared" : "Yes, they can share it"}
        </button>
        <button type="button" className="button secondary" disabled={pending || answer === "no"} onClick={() => choose(false)}>
          {answer === "no" ? "Kept private" : "No, keep it private"}
        </button>
      </div>
      {error && <p className="message error">{error}</p>}
    </>
  );
}

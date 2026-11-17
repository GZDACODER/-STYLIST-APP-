"use client";

// Home, during the free trial (day 3 on): "How's Clientele working for
// you?" with a link to the short questionnaire. "Not now" hides it on this
// device for 3 days. Hidden for good once they've sent feedback.
import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "clientele-feedback-snooze";

export default function FeedbackPrompt({ daysLeft }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      const until = Number(localStorage.getItem(KEY) || 0);
      setHidden(until > Date.now());
    } catch {
      setHidden(false);
    }
  }, []);
  if (hidden) return null;
  return (
    <section className="card feedback-prompt">
      <div>
        <h2>How&apos;s Clientele working for you?</h2>
        <p className="muted small-text">
          {daysLeft} day{daysLeft === 1 ? "" : "s"} left in your trial. Five quick questions help us make it better for
          you.
        </p>
      </div>
      <div className="feedback-prompt-actions">
        <Link href="/dashboard/feedback" className="button small">
          Share feedback
        </Link>
        <button
          type="button"
          className="link-button small-text"
          onClick={() => {
            try {
              localStorage.setItem(KEY, String(Date.now() + 3 * 24 * 60 * 60 * 1000));
            } catch {}
            setHidden(true);
          }}
        >
          Not now
        </button>
      </div>
    </section>
  );
}

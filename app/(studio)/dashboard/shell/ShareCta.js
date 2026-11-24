"use client";

// The primary gold "Share booking link" button. On hover the label
// crossfades to "Fill your book" and a paper plane loops (flies up-right,
// fades, comes back in from the bottom-left, ~1.2s). On touch it plays once
// when tapped. Respects reduced motion.
import { useState } from "react";
import { shareBookingLink } from "./share";

export default function ShareCta({ url, businessName, className = "" }) {
  const [tapped, setTapped] = useState(false);
  const [note, setNote] = useState(null);
  const onClick = async () => {
    setTapped(true);
    setTimeout(() => setTapped(false), 1300);
    const r = await shareBookingLink(url, businessName);
    if (r === "copied") setNote("Link copied");
    else if (r === "failed") setNote("Couldn't copy");
    if (r === "copied" || r === "failed") setTimeout(() => setNote(null), 2200);
  };
  return (
    <span className="cta-wrap">
      <button type="button" className={`button cta-share${tapped ? " is-tapped" : ""} ${className}`} onClick={onClick}>
        <span className="cta-plane" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
            <path d="M21 3 3 10.5l7 2.5 2.5 7L21 3z" />
            <path d="m10 13 4.5-4.5" />
          </svg>
        </span>
        <span className="cta-labels">
          <span className="cta-label">Share booking link</span>
          <span className="cta-label cta-alt" aria-hidden="true">
            Fill your book
          </span>
        </span>
      </button>
      <span className="cta-note" role="status" aria-live="polite">
        {note}
      </span>
    </span>
  );
}

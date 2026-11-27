"use client";

// The landing page's primary "Start free trial": the same delight as the
// app's "Share booking link". On hover the label crossfades to "Claim your
// book" and a paper plane loops; on touch it flies once when tapped.
// Respects reduced motion.
import Link from "next/link";
import { useState } from "react";

export default function TrialCta({ label = "Start free trial", alt = "Claim your book", small = false, href = "/signup" }) {
  const [tapped, setTapped] = useState(false);
  return (
    <Link
      href={href}
      className={`ln-btn ln-btn-gold ln-cta${small ? " ln-btn-small" : ""}${tapped ? " is-tapped" : ""}`}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse") {
          setTapped(true);
          setTimeout(() => setTapped(false), 1300);
        }
      }}
    >
      <span className="ln-plane" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
          <path d="M21 3 3 10.5l7 2.5 2.5 7L21 3z" />
          <path d="m10 13 4.5-4.5" />
        </svg>
      </span>
      <span className="ln-labels">
        <span className="ln-label">{label}</span>
        <span className="ln-label ln-alt" aria-hidden="true">
          {alt}
        </span>
      </span>
    </Link>
  );
}

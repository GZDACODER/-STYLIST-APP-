"use client";

// Settings → Example data & tips: "Show tips again" resets every first-visit guide, so
// each page shows its tips again the next time it's opened.
import { useState, useTransition } from "react";
import { useGuides } from "./GuideProvider";

export default function ShowTipsAgain() {
  const guides = useGuides();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  if (!guides) return null;
  return (
    <section className="card" id="tips">
      <h2>Tips</h2>
      <p className="muted">
        Each page shows a few quick tips the first time you open it. Tap ? next to a page&apos;s title to see them again
        any time.
      </p>
      <button
        type="button"
        className="button secondary small"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await guides.reset();
            setDone(true);
          })
        }
      >
        {pending ? "Resetting..." : "Show tips again"}
      </button>
      {done && <p className="message success">Done. Tips will show again as you open each page.</p>}
    </section>
  );
}

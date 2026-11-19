"use client";

// Asks for a page's (or a step's) first-visit guide, and shows the small "?"
// that replays it. Does nothing outside a GuideProvider.
import { useEffect } from "react";
import { GUIDES } from "@/lib/guides";
import { useGuides } from "./GuideProvider";

export default function PageGuide({ guideKey, auto = true, button = true, className = "" }) {
  const guides = useGuides();
  const ready = guides?.ready;
  const request = guides?.request;
  const cancel = guides?.cancel;

  useEffect(() => {
    if (!auto || !ready || !request) return;
    request(guideKey);
    return () => cancel(guideKey);
  }, [auto, ready, request, cancel, guideKey]);

  if (!guides || !button || !GUIDES[guideKey]) return null;
  return (
    <button
      type="button"
      className={`gd-help ${className}`.trim()}
      onClick={() => guides.start(guideKey)}
      aria-label={`Show tips for ${GUIDES[guideKey].title}`}
      title="Show tips"
    >
      ?
    </button>
  );
}

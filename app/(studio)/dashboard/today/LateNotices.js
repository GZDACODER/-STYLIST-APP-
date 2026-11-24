"use client";

// Today: clients who said they're running late, as a slim banner with Dismiss.
import { useTransition } from "react";
import { clockTime } from "@/lib/availability";
import { lateText } from "@/lib/lateNotices";
import { dismissLate } from "../clientFeatureActions";
import { ExampleTag } from "@/components/dash/Example";

export default function LateNotices({ notices }) {
  const [pending, startTransition] = useTransition();
  if (!notices.length) return null;
  return (
    <section className="late-banner" aria-label="Running late">
      {notices.map((n) => (
        <div key={n.id} className="late-notice">
          <span>
            <strong>{lateText(n)}</strong>
            {n.booking?.start_time && ` for their ${clockTime(n.booking.start_time)} ${n.booking.service_name || ""}`}
            {n.example && <ExampleTag />}
          </span>
          {!n.example && (
            <button type="button" className="link-button small-text" disabled={pending} onClick={() => startTransition(() => dismissLate(n.id))}>
              Dismiss
            </button>
          )}
        </div>
      ))}
    </section>
  );
}

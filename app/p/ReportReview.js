"use client";

import { useActionState, useState } from "react";
import { reportReview } from "./actions";
import { REPORT_REASONS } from "@/lib/reviews";

export default function ReportReview({ id }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(reportReview, null);
  if (state?.success) return <p className="pp-report-done small-text">{state.success}</p>;
  if (!open)
    return (
      <button type="button" className="pp-report-link" onClick={() => setOpen(true)}>
        Report
      </button>
    );
  return (
    <form action={action} className="pp-report">
      <input type="hidden" name="id" value={id} />
      <fieldset>
        <legend className="small-text">What&apos;s wrong with this review?</legend>
        {REPORT_REASONS.map(([k, label]) => (
          <label key={k} className="pp-radio">
            <input type="radio" name="reason" value={k} required /> {label}
          </label>
        ))}
      </fieldset>
      <label className="small-text">
        Anything else? (optional)
        <textarea name="details" rows={2} maxLength={1000} />
      </label>
      <label className="small-text">
        Your email, if we may follow up (optional)
        <input type="email" name="email" maxLength={200} autoComplete="email" />
      </label>
      <div className="pp-actions">
        <button type="submit" className="button secondary" disabled={pending}>
          {pending ? "Sending..." : "Send report"}
        </button>
        <button type="button" className="pp-report-link" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {state?.error && <p className="message error">{state.error}</p>}
    </form>
  );
}

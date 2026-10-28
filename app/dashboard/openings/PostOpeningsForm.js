"use client";

import { useActionState, useEffect, useState } from "react";
import { postOpenings } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function PostOpeningsForm({ today }) {
  const [state, formAction] = useActionState(postOpenings, null);
  const [mode, setMode] = useState("hours");

  // Clear the date boxes after a successful post.
  const [formKey, setFormKey] = useState(0);
  useEffect(() => {
    if (state?.success) setFormKey((k) => k + 1);
  }, [state]);

  return (
    <form action={formAction} key={formKey}>
      <label>
        Date
        <input name="start_date" type="date" min={today} required />
      </label>
      <label>
        Until (optional, to open several days)
        <input name="end_date" type="date" min={today} />
      </label>

      <fieldset className="field">
        <legend>Times</legend>
        <div className="segmented">
          <label className={`segment new`}>
            <input
              type="radio"
              name="times"
              value="hours"
              checked={mode === "hours"}
              onChange={() => setMode("hours")}
            />
            <span>My working hours</span>
          </label>
          <label className={`segment new`}>
            <input
              type="radio"
              name="times"
              value="custom"
              checked={mode === "custom"}
              onChange={() => setMode("custom")}
            />
            <span>Custom times</span>
          </label>
        </div>
      </fieldset>

      {mode === "custom" && (
        <div className="time-range">
          <input type="time" name="from" aria-label="Start time" defaultValue="09:00" required />
          <span className="muted">to</span>
          <input type="time" name="to" aria-label="End time" defaultValue="17:00" required />
        </div>
      )}

      <fieldset className="field">
        <legend>Who can book</legend>
        <div className="segmented">
          <label className="segment everyone">
            <input type="radio" name="visibility" value="everyone" defaultChecked />
            <span>Everyone</span>
          </label>
          <label className="segment regulars">
            <input type="radio" name="visibility" value="regulars" />
            <span>Regulars only</span>
          </label>
        </div>
      </fieldset>

      <SubmitButton pendingText="Opening...">Open for booking</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

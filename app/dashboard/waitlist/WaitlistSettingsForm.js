"use client";

import { useActionState } from "react";
import { saveWaitlistSettings } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

const CHOICES = [10, 15, 30, 45, 60, 90, 120, 180, 240];

function minutesLabel(n) {
  if (n < 60) return `${n} minutes`;
  const hours = n / 60;
  return hours === 1 ? "1 hour" : `${hours} hours`;
}

export default function WaitlistSettingsForm({ enabled, regularsMinutes }) {
  const [state, formAction] = useActionState(saveWaitlistSettings, null);

  return (
    <form action={formAction}>
      <label className="check-row">
        <input type="checkbox" name="waitlist_enabled" defaultChecked={enabled} />
        Let clients join a waitlist when no times work for them
      </label>
      <label>
        When a time opens up, regulars get first pick for
        <select name="waitlist_regulars_minutes" defaultValue={String(regularsMinutes)}>
          {CHOICES.map((n) => (
            <option key={n} value={n}>
              {minutesLabel(n)}
            </option>
          ))}
          <option value="0">No head start (tell everyone at once)</option>
        </select>
      </label>
      <p className="muted small-text">
        Waitlisted regulars are emailed first. If nobody claims the time by then, everyone else on
        the waitlist is emailed. If no regular wants that time, everyone hears straight away.
      </p>
      <SubmitButton pendingText="Saving...">Save</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

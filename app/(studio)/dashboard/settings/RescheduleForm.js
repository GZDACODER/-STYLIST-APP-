"use client";

// How close to a visit clients can still move it themselves (from the
// booking page or the Reschedule link in their emails).
import { useActionState } from "react";
import { saveReschedule } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

const CHOICES = [
  { value: 0, label: "Any time before it starts" },
  { value: 2, label: "Up to 2 hours before" },
  { value: 12, label: "Up to 12 hours before" },
  { value: 24, label: "Up to 24 hours before" },
  { value: 48, label: "Up to 48 hours before" },
  { value: 72, label: "Up to 3 days before" },
  { value: 168, label: "Up to 1 week before" },
];

export default function RescheduleForm({ cutoffHours }) {
  const [state, formAction] = useActionState(saveReschedule, null);
  const value = CHOICES.some((c) => c.value === cutoffHours) ? cutoffHours : 24;

  return (
    <form action={formAction}>
      <label>
        Clients can move their own appointment
        <select name="reschedule_cutoff_hours" defaultValue={String(value)}>
          {CHOICES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <p className="muted small-text">
        Each appointment can be moved twice. Closer to the time, clients see &quot;Contact you to
        change this booking&quot; instead. Deposits stay with the appointment, and you get an email
        each time someone moves.
      </p>
      <SubmitButton pendingText="Saving...">Save</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

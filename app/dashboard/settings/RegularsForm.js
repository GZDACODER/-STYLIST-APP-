"use client";

import { useActionState } from "react";
import { saveRegulars } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

const CHOICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20];

export default function RegularsForm({ autoRegularAfter }) {
  const [state, formAction] = useActionState(saveRegulars, null);

  return (
    <form action={formAction}>
      <label>
        Make a client a Regular after
        <select name="auto_regular_after" defaultValue={String(autoRegularAfter)}>
          {CHOICES.map((n) => (
            <option key={n} value={n}>
              {n} completed {n === 1 ? "appointment" : "appointments"}
            </option>
          ))}
          <option value="0">Never (I&apos;ll pick Regulars myself)</option>
        </select>
      </label>
      <p className="muted small-text">
        An appointment counts once its end time has passed. Cancelled ones don&apos;t count. You
        can still make anyone a Regular, or take them off, on the Clients tab. If you take someone
        off Regular, they won&apos;t be made one again automatically.
      </p>
      <SubmitButton pendingText="Saving...">Save</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

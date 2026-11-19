"use client";

// A service's aftercare tips: emailed to the client a couple of hours after
// each visit for this service, with a one-tap "How was it?".
import { useActionState } from "react";
import { saveAftercare } from "../clientFeatureActions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function AftercareForm({ id, aftercare }) {
  const [state, action] = useActionState(saveAftercare, null);
  return (
    <form action={action} className="stack aftercare-form">
      <input type="hidden" name="id" value={id} />
      <label>
        Aftercare tips (optional)
        <textarea
          name="aftercare"
          rows={3}
          maxLength={2000}
          defaultValue={aftercare}
          placeholder="e.g. Wrap your hair at night. Skip the gym for 24 hours. No heat for 2 days."
        />
      </label>
      <p className="muted small-text">Emailed to the client after each visit for this service.</p>
      <SubmitButton className="button secondary small" pendingText="Saving...">
        Save tips
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

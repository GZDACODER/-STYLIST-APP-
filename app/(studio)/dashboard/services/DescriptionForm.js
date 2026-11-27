"use client";

// A service's description: the short line under it on the booking page.
import { useActionState } from "react";
import { saveDescription } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function DescriptionForm({ id, description, placeholder }) {
  const [state, action] = useActionState(saveDescription, null);
  return (
    <form action={action} className="stack description-form">
      <input type="hidden" name="id" value={id} />
      <label>
        Description (optional)
        <textarea name="description" rows={2} maxLength={300} defaultValue={description} placeholder={placeholder ? `e.g. ${placeholder}` : undefined} />
      </label>
      <p className="muted small-text">Shows under the service on your booking page.</p>
      <SubmitButton className="button secondary small" pendingText="Saving...">
        Save description
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

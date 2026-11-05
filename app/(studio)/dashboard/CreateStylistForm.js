"use client";

import { useActionState } from "react";
import { createMyStylist } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

// For a login that has no stylist profile (for example an email that was
// first used to book on someone's page): make one here.
export default function CreateStylistForm() {
  const [state, formAction] = useActionState(createMyStylist, null);

  return (
    <form action={formAction}>
      <label>
        Business name
        <input name="business_name" type="text" maxLength={100} placeholder="e.g. Cuts by Sam" required />
      </label>
      <label>
        Your first name (optional)
        <input name="first_name" type="text" autoComplete="given-name" maxLength={50} />
      </label>
      <SubmitButton pendingText="Creating...">Create my business account</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

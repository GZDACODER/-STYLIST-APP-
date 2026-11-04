"use client";

import { useActionState } from "react";
import { resendConfirmation } from "@/app/auth/actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

// "Resend confirmation email" for a stylist who didn't get it.
export default function ResendConfirmation({ email }) {
  const [state, formAction] = useActionState(resendConfirmation, null);

  return (
    <form action={formAction} className="resend-confirmation">
      <input type="hidden" name="email" value={email} />
      <SubmitButton className="link-button" pendingText="Sending...">
        Resend confirmation email
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

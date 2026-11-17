"use client";

// "Got a code instead of a link?": enter the code from the sign-up email to
// confirm the account and log in (Sign up and Log in pages).
import { useActionState } from "react";
import { confirmSignupCode } from "@/app/auth/actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function ConfirmCodeForm({ email }) {
  const [state, formAction] = useActionState(confirmSignupCode, null);
  return (
    <form action={formAction} className="confirm-code">
      <input type="hidden" name="email" value={email} />
      <label>
        Got a code instead? Enter it here
        <input
          name="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={10}
          placeholder="Code from the email"
          className="code-input"
          required
        />
      </label>
      <SubmitButton pendingText="Checking...">Confirm and log in</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

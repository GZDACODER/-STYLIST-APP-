"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/auth/actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, null);

  return (
    <form action={formAction}>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <SubmitButton pendingText="Sending...">Email me a reset link</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

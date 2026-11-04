"use client";

import { useActionState } from "react";
import { signup } from "@/app/auth/actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import ResendConfirmation from "@/components/ResendConfirmation";

export default function SignupForm() {
  const [state, formAction] = useActionState(signup, null);

  return (
    <>
    <form action={formAction}>
      <label>
        Business name
        <input name="business_name" type="text" placeholder="e.g. Cuts by Sam" required />
      </label>
      <label>
        Your first name (optional)
        <input name="first_name" type="text" autoComplete="given-name" maxLength={50} />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      <SubmitButton pendingText="Creating account...">Create account</SubmitButton>
      <FormMessage state={state} />
    </form>
    {/* Didn't get the email (or the account already exists unconfirmed). */}
    {state?.email && <ResendConfirmation email={state.email} />}
    </>
  );
}

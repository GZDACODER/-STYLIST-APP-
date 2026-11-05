"use client";

import { useActionState } from "react";
import { signup } from "@/app/auth/actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import ResendConfirmation from "@/components/ResendConfirmation";
import { BUSINESS_TYPES } from "@/lib/businessTypes";

export default function SignupForm() {
  const [state, formAction] = useActionState(signup, null);

  return (
    <>
    <form action={formAction}>
      <label>
        Business name
        <input name="business_name" type="text" placeholder="e.g. Studio Sam" required />
      </label>
      <label>
        What kind of business? (optional)
        <select name="business_type" defaultValue="">
          <option value="">Choose one</option>
          {BUSINESS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
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

"use client";

import { useActionState, useState } from "react";
import { signup } from "@/app/auth/actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import ResendConfirmation from "@/components/ResendConfirmation";
import ConfirmCodeForm from "@/components/ConfirmCodeForm";
import { BUSINESS_TYPES } from "@/lib/businessTypes";

const NOW = BUSINESS_TYPES.filter((t) => !t.soon);
const SOON = BUSINESS_TYPES.filter((t) => t.soon);

export default function SignupForm() {
  const [state, formAction] = useActionState(signup, null);
  const [type, setType] = useState("");
  const soon = SOON.find((t) => t.value === type);

  return (
    <>
    <form action={formAction}>
      <label>
        Business name
        <input name="business_name" type="text" placeholder="e.g. Studio Sam" required />
      </label>
      <label>
        What kind of business? (optional)
        <select name="business_type" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">Choose one</option>
          {NOW.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
          <optgroup label="Coming soon">
            {SOON.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label} (coming soon)
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      {soon && (
        <p className="message info small-text">
          Clientele is built for beauty pros first, so a few things {soon.who} need are still on the way.
          You&apos;re welcome to sign up and try it now, free for the trial, and we&apos;ll email you as we add them.
        </p>
      )}
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
    {state?.email && state?.success && <ConfirmCodeForm email={state.email} />}
    {state?.email && <ResendConfirmation email={state.email} />}
    </>
  );
}

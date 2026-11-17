"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePassword } from "@/app/auth/actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, null);

  return (
    <form action={formAction}>
      <label>
        New password
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <label>
        New password again
        <input name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </label>
      <SubmitButton pendingText="Saving...">Save new password</SubmitButton>
      <FormMessage state={state} />
      {state?.expired && (
        <p>
          <Link href="/forgot-password">Ask for a new link</Link>
        </p>
      )}
    </form>
  );
}

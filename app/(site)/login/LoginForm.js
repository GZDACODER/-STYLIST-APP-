"use client";

import { useActionState } from "react";
import { login } from "@/app/auth/actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function LoginForm() {
  const [state, formAction] = useActionState(login, null);

  return (
    <form action={formAction}>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      <SubmitButton pendingText="Logging in...">Log in</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

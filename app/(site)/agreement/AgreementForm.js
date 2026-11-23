"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import SignaturePad from "@/components/SignaturePad";
import { PRO_TERMS } from "@/lib/agreements";
import { signProTerms } from "./actions";

export default function AgreementForm({ businessName }) {
  const [state, action] = useActionState(signProTerms, null);
  return (
    <form action={action} className="stack">
      <div className="agree-checks">
        {PRO_TERMS.checks.map((c) => (
          <label key={c.key} className="agree-check">
            <input type="checkbox" name={`check_${c.key}`} required />
            <span>{c.label}</span>
          </label>
        ))}
      </div>
      <label>
        Your full legal name
        <input name="legal_name" type="text" autoComplete="name" required minLength={3} maxLength={120} />
      </label>
      <label>
        Business name
        <input name="business_name" type="text" defaultValue={businessName} required maxLength={120} />
      </label>
      <SignaturePad name="signature" label="Your signature" />
      <SubmitButton pendingText="Signing...">Sign and continue</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

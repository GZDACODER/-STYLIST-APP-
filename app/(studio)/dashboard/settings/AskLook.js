"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { askLookConsent } from "./lookActions";

export default function AskLook({ id, again }) {
  const [state, action] = useActionState(askLookConsent, null);
  if (state?.success) return <p className="small-text muted">{state.success}</p>;
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="button small secondary" pendingText="Asking...">
        {again ? "Ask again" : "Ask to share"}
      </SubmitButton>
      {state?.error && <p className="small-text message error">{state.error}</p>}
    </form>
  );
}

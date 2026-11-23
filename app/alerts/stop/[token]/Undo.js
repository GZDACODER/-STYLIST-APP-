"use client";

import { useActionState } from "react";
import { undoStop } from "./actions";

export default function Undo({ token }) {
  const [state, action, pending] = useActionState(undoStop, null);
  if (state?.ok) return <p className="message success">Alerts are back on.</p>;
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <button type="submit" className="button secondary" disabled={pending}>
        {pending ? "Saving..." : "Oops, keep my alerts"}
      </button>
      {state?.error && <p className="message error">{state.error}</p>}
    </form>
  );
}

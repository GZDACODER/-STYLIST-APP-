"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { saveNotify } from "./rulesActions";

export default function NotifyForm({ kinds, notify }) {
  const [state, action] = useActionState(saveNotify, null);
  return (
    <form action={action} className="stack">
      {kinds.map(([k, label, note]) => (
        <label key={k} className="check-row">
          <input type="checkbox" name={k} defaultChecked={notify?.[k] !== false} />
          <span>
            <strong>{label}</strong>
            <span className="muted small-text"> · {note}</span>
          </span>
        </label>
      ))}
      <p className="muted small-text">
        Emails about payments, disputes, your plan and support access always come, so you never miss something important.
      </p>
      <SubmitButton pendingText="Saving...">Save</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

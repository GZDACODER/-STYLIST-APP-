"use client";

import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { approveRequest, declineRequest } from "./actions";

export default function RequestActions({ id, services, serviceId }) {
  const [mode, setMode] = useState(null);
  const [aState, approve] = useActionState(approveRequest, null);
  const [dState, decline] = useActionState(declineRequest, null);
  if (aState?.success || dState?.success) return <FormMessage state={aState?.success ? aState : dState} />;
  return (
    <div className="rq-actions">
      {!mode && (
        <div className="row">
          <button type="button" className="button small" onClick={() => setMode("approve")}>
            Approve
          </button>
          <button type="button" className="button small secondary" onClick={() => setMode("decline")}>
            Decline
          </button>
        </div>
      )}
      {mode === "approve" && (
        <form action={approve} className="stack">
          <input type="hidden" name="id" value={id} />
          <label>
            What can they book?
            <select name="service_id" defaultValue={serviceId || ""}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            A note for them (optional)
            <textarea name="note" rows={3} maxLength={1000} placeholder="e.g. Love this idea! Let's start with a consult." />
          </label>
          <div className="row">
            <SubmitButton className="button small" pendingText="Approving...">
              Approve and send booking link
            </SubmitButton>
            <button type="button" className="link-button small-text" onClick={() => setMode(null)}>
              Back
            </button>
          </div>
          <FormMessage state={aState} />
        </form>
      )}
      {mode === "decline" && (
        <form action={decline} className="stack">
          <input type="hidden" name="id" value={id} />
          <label>
            A note for them (optional)
            <textarea name="note" rows={3} maxLength={1000} placeholder="e.g. I don't do this style, but try ..." />
          </label>
          <div className="row">
            <SubmitButton className="button small secondary" pendingText="Declining...">
              Decline and email them
            </SubmitButton>
            <button type="button" className="link-button small-text" onClick={() => setMode(null)}>
              Back
            </button>
          </div>
          <FormMessage state={dState} />
        </form>
      )}
    </div>
  );
}

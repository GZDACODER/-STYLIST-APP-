"use client";

// "Send note": asks once, then sends the pro their next-step note from
// hello@clientelesuite.com (actions.js). "Write my own" opens your email app.
import { useActionState, useState } from "react";
import { sendNudge } from "./actions";

export default function SendNudge({ id, mailto, label, subject, primary }) {
  const [state, action, pending] = useActionState(sendNudge, null);
  const [asking, setAsking] = useState(false);
  if (state?.success) return <p className="small-text lw-sent">✓ {state.success}</p>;
  return (
    <div className="lw-send">
      {asking ? (
        <form action={action} className="lw-confirm">
          <input type="hidden" name="id" value={id} />
          <p className="small-text">Send &quot;{subject}&quot; from hello@clientelesuite.com?</p>
          <div className="lw-confirm-row">
            <button type="submit" className="button small" disabled={pending}>
              {pending ? "Sending..." : "Yes, send"}
            </button>
            <button type="button" className="button small secondary" onClick={() => setAsking(false)}>
              Not now
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className={`button small${primary ? "" : " secondary"}`} onClick={() => setAsking(true)}>
          {label}
        </button>
      )}
      {state?.error && <p className="small-text message error">{state.error}</p>}
      <a href={mailto} className="small-text">
        Write my own
      </a>
    </div>
  );
}

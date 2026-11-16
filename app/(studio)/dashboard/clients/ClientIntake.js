"use client";

// "Intake form" on a client card: their newest answers and waiver signature,
// whether it's current, and "Ask again" (they fill it in on their next
// booking of a service that needs it). Loaded when opened.
import { useState, useTransition } from "react";
import { askIntakeAgain, getClientIntake } from "../intake/actions";

const when = (iso) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function ClientIntake({ clientId }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [message, setMessage] = useState(null);
  const [pending, startTransition] = useTransition();

  function load() {
    startTransition(async () => setData(await getClientIntake(clientId)));
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }

  function askAgain() {
    setMessage(null);
    startTransition(async () => {
      const result = await askIntakeAgain(clientId);
      if (result.error) setMessage({ error: result.error });
      else {
        setMessage({ success: "They'll be asked to fill it in again on their next booking." });
        setData(await getClientIntake(clientId));
      }
    });
  }

  // Hidden entirely until the step 28 SQL is run.
  if (data?.missing) return null;
  const intake = data?.intake;
  const response = intake?.response;

  return (
    <div className="client-history client-intake">
      <button type="button" className="link-button" onClick={toggle} aria-expanded={open}>
        {open ? "Hide intake form" : "Intake form"}
      </button>

      {open && pending && !data && <p className="muted small-text">Loading...</p>}
      {open && data?.error && <p className="message error">{data.error}</p>}

      {open && intake && (
        <div className="history-body">
          {!response ? (
            <p className="muted small-text">Not filled in yet. They&apos;ll be asked when they book a service that needs it.</p>
          ) : (
            <>
              <p className="small-text">
                <span className={intake.on_file ? "badge paid" : "badge unpaid"}>
                  {intake.on_file ? "On file" : "Needs filling in again"}
                </span>{" "}
                <span className="muted">Filled in {when(response.created_at)} · form version {response.form_version}</span>
              </p>
              {response.answers?.length > 0 && (
                <dl className="intake-answers">
                  {response.answers.map((a) => (
                    <div key={a.id}>
                      <dt>{a.label}</dt>
                      <dd>{a.answer || <span className="muted">No answer</span>}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {response.signed_name && (
                <details className="intake-signed">
                  <summary>
                    Waiver signed by <strong>{response.signed_name}</strong> on {when(response.signed_at)}
                  </summary>
                  <p className="intake-waiver-copy">{response.waiver_text}</p>
                </details>
              )}
            </>
          )}
          <p>
            <button type="button" className="link-button quiet-link" onClick={askAgain} disabled={pending}>
              Ask again
            </button>
          </p>
          {message?.error && <p className="message error">{message.error}</p>}
          {message?.success && <p className="message success">{message.success}</p>}
        </div>
      )}
    </div>
  );
}

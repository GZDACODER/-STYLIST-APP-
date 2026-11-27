"use client";

// The owner's actions on one pro (../actions.js): founding pro, more free
// days, free account on/off, and an email from hello@clientelesuite.com.
import { useActionState } from "react";
import { emailPro, extendTrial, makeFounding, setFree } from "../actions";

function Result({ state }) {
  if (state?.error) return <p className="message error small-text">{state.error}</p>;
  if (state?.success) return <p className="message success small-text">✓ {state.success}</p>;
  return null;
}

export default function ProActions({ id, paying, free, founding, firstName, email }) {
  const [fState, fAction, fPending] = useActionState(makeFounding, null);
  const [xState, xAction, xPending] = useActionState(extendTrial, null);
  const [cState, cAction, cPending] = useActionState(setFree, null);
  const [eState, eAction, ePending] = useActionState(emailPro, null);

  return (
    <section className="card ap-actions">
      <h2>Actions</h2>

      {!paying && (
        <>
          <form action={fAction} className="ap-action">
            <input type="hidden" name="id" value={id} />
            <div>
              <p className="ap-action-title">Founding pro</p>
              <p className="muted small-text">2 months free from when they signed up. They pay after that, like everyone else.</p>
            </div>
            <button type="submit" className="button small" disabled={fPending}>
              {fPending ? "Saving…" : founding ? "Make founding again" : "Make founding pro"}
            </button>
          </form>
          <Result state={fState} />

          <form action={xAction} className="ap-action">
            <input type="hidden" name="id" value={id} />
            <div>
              <p className="ap-action-title">More free days</p>
              <p className="muted small-text">Adds to their free trial, or starts again from today if it ended.</p>
            </div>
            <div className="ap-inline">
              <select name="days" defaultValue="14" aria-label="How many days">
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
              <button type="submit" className="button small secondary" disabled={xPending}>
                {xPending ? "Saving…" : "Add"}
              </button>
            </div>
          </form>
          <Result state={xState} />
        </>
      )}
      {paying && <p className="muted small-text">They&apos;re paying through Stripe. Change or refund their plan in the Stripe dashboard.</p>}

      <form action={cAction} className="ap-action">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="on" value={free ? "0" : "1"} />
        <div>
          <p className="ap-action-title">Free account</p>
          <p className="muted small-text">{free ? "On: they never pay." : "Never asks them to pay. For friends, partners and your own accounts."}</p>
        </div>
        <button type="submit" className="button small secondary" disabled={cPending}>
          {cPending ? "Saving…" : free ? "Turn off" : "Turn on"}
        </button>
      </form>
      <Result state={cState} />

      <form action={eAction} className="ap-email">
        <input type="hidden" name="id" value={id} />
        <p className="ap-action-title">Email {firstName || "them"}</p>
        <p className="muted small-text">From hello@clientelesuite.com to {email || "their email"}. Replies come to you.</p>
        <label className="visually-hidden" htmlFor="ap-subject">Subject</label>
        <input id="ap-subject" name="subject" placeholder="Subject" maxLength={150} required />
        <label className="visually-hidden" htmlFor="ap-body">Message</label>
        <textarea id="ap-body" name="body" rows={6} placeholder={`Hi ${firstName || "there"},\n\n`} required />
        <button type="submit" className="button small" disabled={ePending}>
          {ePending ? "Sending…" : "Send email"}
        </button>
        <Result state={eState} />
      </form>
    </section>
  );
}

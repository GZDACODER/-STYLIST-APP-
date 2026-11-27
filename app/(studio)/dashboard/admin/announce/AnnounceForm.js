"use client";

// Compose an email to pros: who it's for (with how many), subject, message.
// "Send me a test" first; then "Send to N pros", which asks once more.
import { useActionState, useState } from "react";
import { sendAnnouncement } from "./actions";

export default function AnnounceForm({ audiences }) {
  const [state, action, pending] = useActionState(sendAnnouncement, null);
  const [audience, setAudience] = useState("all");
  const [confirming, setConfirming] = useState(false);
  const count = audiences.find((a) => a.key === audience)?.count ?? 0;

  if (state?.done) {
    return (
      <section className="card">
        <p className="message success">✓ {state.success}</p>
        <a href="/dashboard/admin/announce" className="button small secondary">Write another</a>
      </section>
    );
  }

  return (
    <form action={action} className="card an-form">
      <label>
        Who it&apos;s for
        <select name="audience" value={audience} onChange={(e) => { setAudience(e.target.value); setConfirming(false); }}>
          {audiences.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label} ({a.count})
            </option>
          ))}
        </select>
      </label>
      <label>
        Subject
        <input name="subject" maxLength={150} required placeholder="e.g. New: share your link to Instagram in one tap" />
      </label>
      <label>
        Message
        <textarea name="body" rows={10} required placeholder={"Each pro's name is added for you (\"Hi Sam,\").\n\nLeave a blank line between paragraphs. Links work."} />
      </label>
      <p className="muted small-text">
        From hello@clientelesuite.com. Replies come to you. A line at the bottom tells pros how to stop Clientele news. Test, demo and paused accounts, and pros who turned off Clientele news, are left out.
      </p>
      {state?.error && <p className="message error">{state.error}</p>}
      {state?.success && <p className="message success">✓ {state.success}</p>}
      <div className="an-buttons">
        <button type="submit" name="mode" value="test" className="button secondary" disabled={pending}>
          {pending && !confirming ? "Sending…" : "Send me a test"}
        </button>
        {confirming ? (
          <>
            <button type="submit" name="mode" value="all" className="button" disabled={pending || count === 0}>
              {pending ? "Sending…" : `Yes, send to ${count}`}
            </button>
            <button type="button" className="link-button" onClick={() => setConfirming(false)}>
              Not yet
            </button>
          </>
        ) : (
          <button type="button" className="button" disabled={count === 0} onClick={() => setConfirming(true)}>
            Send to {count} {count === 1 ? "pro" : "pros"}
          </button>
        )}
      </div>
    </form>
  );
}

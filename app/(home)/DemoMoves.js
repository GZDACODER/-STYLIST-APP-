"use client";

// The live Home's three moves, in the app's "Fill your book" card style.
// Nothing is sent: each tap only changes the sample studio (lib/landingDemo).
const money = (cents) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: cents % 100 ? 2 : 0 })}`;
const hours = (m) => {
  const h = Math.round((m / 60) * 2) / 2;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
};

function Move({ kind, title, text, button, done, disabled, onMove }) {
  return (
    <li className={`hf-move hf-move-${kind}${done ? " is-done" : ""}`}>
      <p className="hf-move-title">{title}</p>
      {text && <p className="hf-move-text">{text}</p>}
      <div className="hf-move-actions">
        {done ? (
          <p className="hf-move-result">✓ {done}</p>
        ) : (
          <button type="button" className="ln-btn ln-btn-gold ln-btn-small" disabled={disabled} onClick={() => onMove(kind)}>
            {button}
          </button>
        )}
      </div>
    </li>
  );
}

export default function DemoMoves({ state, openMinLeft, onMove, busy, words }) {
  const { owed, overdue, done } = state;
  return (
    <ul className="hf-moves ln-demo-moves">
      <Move kind="remind" title={`${money(owed.cents)} owed by ${owed.name}`} text={`for ${owed.service}`} button="Send reminder" done={done.remind} disabled={busy} onMove={onMove} />
      <Move
        kind="invite"
        title={`${overdue.name} usually comes every ${overdue.usualWeeks} weeks. It's been ${overdue.sinceWeeks}.`}
        button="Invite back"
        done={done.invite}
        disabled={busy}
        onMove={onMove}
      />
      <Move
        kind="share"
        title={openMinLeft > 0 ? `${hours(openMinLeft)} hours still open this week.` : "Your week is full."}
        text={`Share your link where your ${words?.clients || "clients"} will see it.`}
        button="Share your link"
        done={done.share}
        disabled={busy}
        onMove={onMove}
      />
    </ul>
  );
}

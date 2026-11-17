// The same "nothing here yet" box everywhere: a short title, one line, and
// (optionally) the button that fixes it.
export default function EmptyState({ title, text, action }) {
  return (
    <div className="db-empty">
      <p className="db-empty-title">{title}</p>
      {text && <p className="muted small-text">{text}</p>}
      {action && <div className="db-empty-action">{action}</div>}
    </div>
  );
}

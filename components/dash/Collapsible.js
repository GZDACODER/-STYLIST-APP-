// A group that starts closed (Past, Cancelled, Archived...): tap the title
// to open it. count: shown after the title.
export default function Collapsible({ title, count, children, open = false, id }) {
  return (
    <details className="card db-collapse" open={open} id={id}>
      <summary>
        <h2>
          {title}
          {count != null && <span className="db-collapse-count"> ({count})</span>}
        </h2>
        <span className="db-chevron" aria-hidden="true" />
      </summary>
      <div className="db-collapse-body">{children}</div>
    </details>
  );
}

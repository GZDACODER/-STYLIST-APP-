// The same header on every dashboard tab: a small line above (optional), the
// page title, a short line below (optional), and the tab's main button(s) on
// the right (they drop under the title on phones).
export default function PageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <header className="db-pagehead">
      <div className="db-pagehead-text">
        {eyebrow && <p className="db-date">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p className="muted small-text db-pagehead-sub">{subtitle}</p>}
      </div>
      {actions && <div className="db-pagehead-actions">{actions}</div>}
    </header>
  );
}

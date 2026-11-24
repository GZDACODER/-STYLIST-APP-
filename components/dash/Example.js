// Example data UI (lib/examples.js): the "Example" tag on rows, and the
// panel an example opens. Examples are never saved, so the panel explains
// that and offers to add a real one instead of editing it.
import Link from "next/link";

export function ExampleTag() {
  return <span className="badge example-tag row-badge">Example</span>;
}

// facts: [[label, value]] shown like a details panel. addHref/addLabel: the
// blank form for a real one ("+ Add client").
export function ExampleCard({ title, facts = [], children, addHref, addLabel }) {
  return (
    <div className="client-card example-card">
      <div className="client-top">
        <div className="client-name">{title}</div>
        <ExampleTag />
      </div>
      <p className="message info small-text">
        This is an example, so you can see how it works. It isn&apos;t saved, clients never see it, and it
        disappears once you add your own (or turn off Show example data in Settings → Example data & tips).
      </p>
      {facts.length > 0 && (
        <dl className="booking-facts">
          {facts.filter(([, v]) => v != null && v !== "").map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
      {addHref && (
        <p>
          <Link href={addHref} className="button small">
            {addLabel}
          </Link>
        </p>
      )}
    </div>
  );
}

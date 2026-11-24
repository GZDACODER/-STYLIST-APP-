// Insights: rebooking, retention, new vs returning, busiest and slowest
// times, no-shows and late cancels, top services, average ticket and tips,
// and overdue clients to invite back. Charts are drawn here (no library).
import { formatPrice } from "@/lib/money";
import { formatDate } from "@/lib/availability";
import { PARTS } from "@/lib/insights";
import Words from "@/components/Words";
import InviteBack from "./InviteBack";

const pct = (r) => (r == null ? "–" : `${Math.round(r * 100)}%`);

function Stat({ label, value, note }) {
  return (
    <div className="in-stat">
      <p className="in-stat-label">{label}</p>
      <p className="in-stat-value">{value}</p>
      {note && <p className="in-stat-note">{note}</p>}
    </div>
  );
}

export default function InsightsView({ x, compare, invitedRecently, emailOf }) {
  const max = Math.max(1, ...x.grid.flat());
  const topMax = Math.max(1, ...x.topServices.map((s) => s.cents));
  return (
    <>
      <section className="card">
        <h2>How your clients come back</h2>
        <div className="in-stats">
          <Stat label="Rebooked" value={pct(x.rebookRate)} note={x.rebookable ? `${x.rebooked} of ${x.rebookable} visits booked again` : "No visits yet"} />
          <Stat label="Came back" value={pct(x.retention)} note={x.prevClients ? `${x.kept} of ${x.prevClients} clients from ${compare}` : `No clients in ${compare}`} />
          <Stat label="New clients" value={x.newClients} note={`${x.returning} returning`} />
          <Stat label="Average ticket" value={x.avgTicketCents == null ? "–" : formatPrice(x.avgTicketCents)} note={x.avgTipCents ? `${formatPrice(x.avgTipCents)} average tip` : x.tipsCents ? `${formatPrice(x.tipsCents)} in tips` : "Tips you record in Money show here"} />
          <Stat label="No-shows" value={pct(x.noShowRate)} note={`${x.noShows} this period`} />
          <Stat label="Late cancels" value={pct(x.lateCancelRate)} note={`${x.lateCancels} within 24 hours of the start`} />
        </div>
      </section>

      <section className="card">
        <h2>Busiest and slowest times</h2>
        <p className="muted small-text">
          The last 12 weeks and the next 4.
          {x.busiest.length > 0 && ` Busiest: ${x.busiest.join(", ")}.`}
          {x.slowest.length > 0 && ` Quietest: ${x.slowest.join(", ")}. A good time for regulars-only openings or an offer.`}
        </p>
        <div className="in-grid" role="table" aria-label="Visits by day and time">
          <div role="row" className="in-grid-row">
            <span role="columnheader" />
            {x.DAYS.map((d) => (
              <span key={d} role="columnheader" className="in-grid-head">
                {d}
              </span>
            ))}
          </div>
          {PARTS.map(([k, label, note], p) => (
            <div role="row" key={k} className="in-grid-row">
              <span role="rowheader" className="in-grid-side" title={note}>
                {label}
              </span>
              {x.DAYS.map((d, di) => {
                const n = x.grid[di][p];
                const off = !x.workingCells.has(`${di}-${p}`) && n === 0;
                return (
                  <span key={d} role="cell" className={off ? "in-cell off" : "in-cell"} style={off ? undefined : { "--a": (0.08 + (n / max) * 0.92).toFixed(2), color: n / max > 0.45 ? "#fff" : "var(--ink)" }} title={`${d} ${label.toLowerCase()}: ${n}`}>
                    {off ? "" : n}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>
          <Words>Top services</Words>
        </h2>
        {x.topServices.length === 0 ? (
          <p className="muted small-text">Nothing yet this period.</p>
        ) : (
          <ul className="in-bars">
            {x.topServices.map((s) => (
              <li key={s.name}>
                <span className="in-bar-name">{s.name}</span>
                <span className="in-bar">
                  <span style={{ width: `${(s.cents / topMax) * 100}%` }} />
                </span>
                <span className="in-bar-num">
                  {formatPrice(s.cents)} · {s.visits}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>
          <Words>Clients to invite back</Words>
        </h2>
        <p className="muted small-text">
          <Words>Clients past their usual gap between visits (or 8 weeks, if they&apos;ve been once) with nothing booked.</Words>
          {x.overdueCount > x.overdue.length ? ` Showing ${x.overdue.length} of ${x.overdueCount}.` : ""}
        </p>
        {x.overdue.length === 0 ? (
          <p className="small-text">Nobody&apos;s overdue. Nice.</p>
        ) : (
          <ul className="rq-list">
            {x.overdue.map((o) => (
              <li key={o.clientId} className="mn-row">
                <p className="rq-head">
                  <span>{o.name}</span>
                  <span className="badge">{Math.round(o.since / 7)} weeks</span>
                </p>
                <p className="muted small-text">
                  Last: {o.service}, {formatDate(o.last)} · {o.visits} {o.visits === 1 ? "visit" : "visits"}
                  {o.usual ? ` · usually every ${Math.round(o.usual / 7) || 1} ${Math.round(o.usual / 7) === 1 ? "week" : "weeks"}` : ""}
                </p>
                {emailOf[o.clientId] ? (
                  <InviteBack id={o.clientId} serviceId={o.serviceId} invitedRecently={invitedRecently.has(o.clientId)} />
                ) : (
                  <p className="small-text muted">No email on file</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

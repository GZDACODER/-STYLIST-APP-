// The Reports page's layout, given the numbers (see page.js and lib/reports.js).
import Link from "next/link";
import { formatDate } from "@/lib/availability";
import { formatPrice } from "@/lib/money";
import { PERIODS } from "@/lib/reports";
import RevenueChart from "./RevenueChart";

const money = (cents) => formatPrice(cents).replace(/\.00$/, "");
const pct = (x) => `${Math.round(x * 100)}%`;

// "+12% vs last month", or nothing when there's nothing to compare with.
function change(now, before, compare) {
  if (!before) return null;
  const diff = (now - before) / before;
  if (Math.abs(diff) < 0.005) return `Same as ${compare}`;
  return `${diff > 0 ? "+" : "\u2212"}${Math.round(Math.abs(diff) * 100)}% vs ${compare}`;
}

export default function ReportsView({ period, range, today, s: thisPeriod, before, series, owed }) {
  const s = thisPeriod;
  const regShare = s.revenueCents ? s.regular.cents / s.revenueCents : null;
  const avg = (g) => (g.visits ? money(Math.round(g.cents / g.visits)) : "—");
  const label = PERIODS.find((p) => p.value === period).label;
  const through = range.to > today ? ` (to ${formatDate(today).replace(/^\w+, /, "")})` : "";

  const tiles = [
    { label: "Revenue", value: money(s.revenueCents), note: change(s.revenueCents, before.revenueCents, range.compare) },
    { label: "Visits", value: String(s.visits), note: change(s.visits, before.visits, range.compare) },
    {
      label: "No-show rate",
      value: s.noShowRate == null ? "—" : pct(s.noShowRate),
      note: s.noShows ? `${s.noShows} no-show${s.noShows === 1 ? "" : "s"}` : "No no-shows",
    },
    {
      label: "Deposits collected",
      value: money(s.depositsCents),
      note: s.depositsCount ? `${s.depositsCount} paid` : "None paid",
    },
  ];

  return (
    <>
      <section className="card">
        <div className="rp-head">
          <h2>Reports</h2>
          <nav className="filter-chips rp-periods" aria-label="Period">
            {PERIODS.map((p) => (
              <Link
                key={p.value}
                href={p.value === "this_month" ? "/dashboard/reports" : `/dashboard/reports?period=${p.value}`}
                className={p.value === period ? "chip active" : "chip"}
                aria-current={p.value === period ? "page" : undefined}
                scroll={false}
              >
                {p.label}
              </Link>
            ))}
          </nav>
        </div>
        <p className="muted small-text">
          {label}: {formatDate(range.from)} – {formatDate(range.to)}
          {through}. Revenue is the service price of visits that went ahead (not no-shows).
        </p>

        <div className="rp-tiles">
          {tiles.map((t) => (
            <div key={t.label} className="rp-tile">
              <span className="db-label">{t.label}</span>
              <strong className="rp-value">{t.value}</strong>
              {t.note && <span className="muted small-text">{t.note}</span>}
            </div>
          ))}
        </div>

        {s.aheadVisits > 0 && (
          <p className="muted small-text">
            Booked ahead in this period: {s.aheadVisits} more {s.aheadVisits === 1 ? "visit" : "visits"} (
            {money(s.aheadCents)}).
          </p>
        )}
      </section>

      <section className="card">
        <h2>Revenue by {range.buckets === "month" ? "month" : "week"}</h2>
        <p className="muted small-text">Split by who the client is: Regulars, or New (everyone else).</p>
        <RevenueChart series={series} from={range.from} kind={range.buckets} />
      </section>

      <section className="card">
        <h2>Regulars vs new clients</h2>
        <p className="muted small-text">
          {regShare == null
            ? "No visits in this period yet."
            : `Regulars brought in ${pct(regShare)} of revenue.`}{" "}
          {s.newClients > 0 && `${s.newClients} new ${s.newClients === 1 ? "client" : "clients"} added.`}
        </p>
        <div className="table-wrap">
          <table className="rp-table">
            <thead>
              <tr>
                <th scope="col">Clients</th>
                <th scope="col">Visits</th>
                <th scope="col">Revenue</th>
                <th scope="col">Per visit</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">
                  <i className="rp-key regular" aria-hidden="true" /> Regulars
                </th>
                <td>{s.regular.visits}</td>
                <td>{money(s.regular.cents)}</td>
                <td>{avg(s.regular)}</td>
              </tr>
              <tr>
                <th scope="row">
                  <i className="rp-key new" aria-hidden="true" /> New
                </th>
                <td>{s.newer.visits}</td>
                <td>{money(s.newer.cents)}</td>
                <td>{avg(s.newer)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted small-text">Regulars are the clients who are Regulars now.</p>
      </section>

      <section className="card">
        <h2>Bookings</h2>
        <div className="table-wrap">
          <table className="rp-table">
            <tbody>
              <tr><th scope="row">Visits that went ahead</th><td>{s.visits}</td></tr>
              <tr><th scope="row">No-shows</th><td>{s.noShows}</td></tr>
              <tr><th scope="row">Someone else came</th><td>{s.replaced}</td></tr>
              <tr><th scope="row">Cancelled</th><td>{s.cancelled}</td></tr>
              <tr><th scope="row">Moved by clients</th><td>{s.moved}</td></tr>
              <tr>
                <th scope="row">Not marked yet</th>
                <td>
                  {s.unmarked}
                  {s.unmarked > 0 && (
                    <>
                      {" · "}
                      <Link href="/dashboard/wrapup">Wrap up</Link>
                    </>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {s.unmarked > 0 && (
          <p className="muted small-text">Visits not marked yet count as having gone ahead.</p>
        )}
      </section>

      <section className="card">
        <h2>Deposits</h2>
        <div className="table-wrap">
          <table className="rp-table">
            <tbody>
              <tr><th scope="row">Collected</th><td>{money(s.depositsCents)}</td></tr>
              <tr><th scope="row">Clientele fee (3% + 30¢ each)</th><td>−{money(s.feesCents)}</td></tr>
              <tr className="rp-total"><th scope="row">To your Stripe account</th><td>{money(s.depositsCents - s.feesCents)}</td></tr>
              <tr><th scope="row">Kept from cancellations</th><td>{money(s.keptCents)}{s.keptCount ? ` (${s.keptCount})` : ""}</td></tr>
              {s.refundedCents > 0 && (
                <tr><th scope="row">Refunded</th><td>{money(s.refundedCents)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="muted small-text">Counted on the day each deposit was paid. Stripe&apos;s own fees aren&apos;t included.</p>
      </section>

      <section className="card">
        <h2>Balances owed</h2>
        <p>
          {owed.count === 0
            ? "Nobody owes you anything."
            : `${owed.count} ${owed.count === 1 ? "visit has" : "visits have"} a balance owed: ${money(owed.cents)} in all.`}{" "}
          {owed.count > 0 && <Link href="/dashboard/notes">See them in Notes</Link>}
        </p>
        <p className="muted small-text">Any date, not only this period. Uses the amount written in Notes, else the price less any deposit.</p>
      </section>
    </>
  );
}

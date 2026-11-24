// Your data: download everything, any time (Settings > Privacy & support).
import Link from "next/link";

const FILES = [
  ["clients", "Clients", "Names, emails, phone numbers, status, birthdays and notes"],
  ["bookings", "Bookings", "Every booking with its service, price, deposit and outcome"],
  ["payments", "Payments you recorded", "Tips, product sales and balances from Money"],
];

export function DataSection() {
  return (
    <>
      <section className="card">
        <h2>Download your data</h2>
        <p className="muted small-text">Spreadsheet files (CSV) that open in Excel, Numbers or Google Sheets.</p>
        <ul className="rq-list">
          {FILES.map(([k, l, note]) => (
            <li key={k} className="mn-row">
              <p className="rq-head">
                <span>{l}</span>
                <a className="button small secondary" href={`/dashboard/settings/data/export?what=${k}`}>
                  Download
                </a>
              </p>
              <p className="muted small-text">{note}</p>
            </li>
          ))}
        </ul>
        <p className="muted small-text">
          Money summaries by period are in <Link href="/dashboard/money">Money</Link>. Signed agreements are in{" "}
          <Link href="/dashboard/settings/plan#agreements">Plan &amp; billing</Link>.
        </p>
      </section>
      <section className="card">
        <h2>Privacy</h2>
        <p className="small-text">
          We never sell your data or your clients&apos; data. Read our <Link href="/privacy">Privacy Policy</Link>. To close your account and delete your
          data, tell us in <Link href="/dashboard/feedback">Share feedback</Link> and we&apos;ll take care of it.
        </p>
      </section>
    </>
  );
}

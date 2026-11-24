"use client";

// A client card's history, loaded once when the card opens, shown on its
// tabs: a summary on Overview, "Visits & notes" (past visits with notes you
// can edit, upcoming, cancellations) and "Payments" (deposits and payments
// recorded on Money).
import { useCallback, useEffect, useState, useTransition } from "react";
import VisitNoteForm from "../notes/VisitNoteForm";
import { KIND_LABEL, METHOD_LABEL } from "@/lib/moneyTab";
import { getClientHistory } from "./historyActions";
import { clockTime, parseDateString } from "@/lib/availability";
import { formatPrice } from "@/lib/money";
import { outcomeLabel } from "@/lib/outcomes";

// "Tue, Nov 10" (the year only when it isn't this year).
function shortDate(text) {
  const day = parseDateString(text);
  return day.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(day.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
  });
}

// "3 weeks ago", "today"...
function ago(text) {
  const days = Math.round((Date.now() - parseDateString(text).getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  if (days < 730) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365)} years ago`;
}

const money = (cents) => formatPrice(cents).replace(/\.00$/, "");

export function useClientHistory(clientId, example) {
  const [history, setHistory] = useState(null);
  const [pending, startTransition] = useTransition();
  const load = useCallback(() => {
    if (example) return;
    startTransition(async () => setHistory(await getClientHistory(clientId)));
  }, [clientId, example]);
  useEffect(load, [load]);
  return { history, pending, reload: load };
}

function Status({ history, pending }) {
  if (pending && !history) return <p className="muted small-text">Loading...</p>;
  if (history?.error) return <p className="message error">{history.error}</p>;
  return null;
}

// Overview: the four numbers and any flags.
export function HistorySummary({ history, pending }) {
  if (!history || history.error) return <Status history={history} pending={pending} />;
  return (
    <div className="history-body">
      <dl className="history-stats">
        <div>
          <dt>Visits</dt>
          <dd>{history.visits}</dd>
        </div>
        <div>
          <dt>Spent</dt>
          <dd>{money(history.spentCents)}</dd>
        </div>
        <div>
          <dt>Cancelled</dt>
          <dd>{history.cancelled}</dd>
        </div>
        <div>
          <dt>Last visit</dt>
          <dd>{history.lastVisit ? ago(history.lastVisit.booking_date) : "Not yet"}</dd>
        </div>
      </dl>
      {(history.noShows > 0 || history.owed > 0 || history.replaced > 0) && (
        <p className="history-flags">
          {history.noShows > 0 && (
            <span className="badge blocked">
              {history.noShows === 1 ? "1 no-show" : `${history.noShows} no-shows`}
            </span>
          )}
          {history.owed > 0 && (
            <span className="badge unpaid">
              {history.owed === 1 ? "1 balance owed" : `${history.owed} balances owed`}
            </span>
          )}
          {history.replaced > 0 && (
            <span className="badge">
              {history.replaced === 1 ? "1 time someone else came" : `${history.replaced} times someone else came`}
            </span>
          )}
        </p>
      )}
      {history.upcoming.length > 0 && (
        <p className="muted small-text">
          Next: {shortDate(history.upcoming[0].booking_date)} · {clockTime(history.upcoming[0].start_time)} ·{" "}
          {history.upcoming[0].service_name}
        </p>
      )}
    </div>
  );
}

// Visits & notes: what used to be the Notes page, for one client.
export function VisitsTab({ history, pending, cardNote, onSaved }) {
  if (!history || history.error) return <Status history={history} pending={pending} />;
  const none = history.recent.length === 0 && history.upcoming.length === 0 && history.cancelled === 0;
  return (
    <div className="history-body">
      {cardNote && (
        <p className="client-notes">
          <strong>Card note:</strong> {cardNote}
        </p>
      )}
      {history.upcoming.length > 0 && (
        <>
          <h4 className="history-title">
            Upcoming{history.upcomingCount > history.upcoming.length && ` (${history.upcomingCount})`}
          </h4>
          <ul className="history-list">
            {history.upcoming.map((b) => (
              <li key={b.id}>
                <span>
                  {shortDate(b.booking_date)} · {clockTime(b.start_time)}
                </span>
                <span className="muted">{b.service_name}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {history.recent.length > 0 && (
        <>
          <h4 className="history-title">Past visits</h4>
          <ul className="history-list">
            {history.recent.map((b) => (
              <li key={b.id}>
                <span>{shortDate(b.booking_date)}</span>
                <span className="muted">
                  {b.service_name} · {formatPrice(b.price_cents)}
                  {b.outcome && ` · ${outcomeLabel(b.outcome)}`}
                </span>
                {"visit_note" in b ? (
                  <VisitNoteForm
                    bookingId={b.id}
                    note={b.visit_note}
                    owedCents={b.owed_cents}
                    owed={b.outcome === "completed_owed"}
                    onSaved={onSaved}
                  />
                ) : (
                  b.visit_note && <span className="history-note">{b.visit_note}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {history.recentCancelled.length > 0 && (
        <>
          <h4 className="history-title">Recent cancellations</h4>
          <ul className="history-list">
            {history.recentCancelled.map((b) => (
              <li key={b.id}>
                <span>
                  {shortDate(b.booking_date)} · {clockTime(b.start_time)}
                </span>
                <span className="muted">{b.service_name}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {none && <p className="muted small-text">No visits yet. Notes you add after a visit show here.</p>}
    </div>
  );
}

// Payments: deposits taken online and payments recorded on Money.
export function PaymentsTab({ history, pending }) {
  if (!history || history.error) return <Status history={history} pending={pending} />;
  return (
    <div className="history-body">
      <dl className="history-stats">
        <div>
          <dt>Paid you</dt>
          <dd>{money(history.paidCents || 0)}</dd>
        </div>
        <div>
          <dt>Deposits kept</dt>
          <dd>{money(history.depositsKeptCents || 0)}</dd>
        </div>
      </dl>
      {(history.payments || []).length === 0 ? (
        <p className="muted small-text">No payments yet. Deposits and payments you record on Money show here.</p>
      ) : (
        <ul className="history-list">
          {history.payments.map((p) => (
            <li key={p.id}>
              <span>
                {shortDate(p.date)} · <strong>{money(p.amountCents)}</strong>
              </span>
              <span className="muted">
                {p.kind === "deposit" ? "Deposit · online" : `${KIND_LABEL[p.kind] || p.kind} · ${METHOD_LABEL[p.method] || p.method}`}
                {p.note && ` · ${p.note}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="small-text">
        <a href="/dashboard/money#record">Record a payment</a>
      </p>
    </div>
  );
}

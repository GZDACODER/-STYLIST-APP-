"use client";

// "History" on a client card: opens to show their visits, upcoming
// appointments, cancellations and what they've spent. Loaded when opened.
import { useState, useTransition } from "react";
import { getClientHistory } from "./historyActions";
import { clockTime, parseDateString } from "@/lib/availability";
import { formatPrice } from "@/lib/money";

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

export default function ClientHistory({ clientId }) {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState(null);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      startTransition(async () => setHistory(await getClientHistory(clientId)));
    }
  }

  return (
    <div className="client-history">
      <button type="button" className="link-button" onClick={toggle} aria-expanded={open}>
        {open ? "Hide history" : "History"}
      </button>

      {open && (pending || !history) && <p className="muted small-text">Loading...</p>}
      {open && !pending && history?.error && <p className="message error">{history.error}</p>}

      {open && !pending && history && !history.error && (
        <div className="history-body">
          <dl className="history-stats">
            <div>
              <dt>Visits</dt>
              <dd>{history.visits}</dd>
            </div>
            <div>
              <dt>Spent</dt>
              <dd>{formatPrice(history.spentCents).replace(/\.00$/, "")}</dd>
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
          {history.depositsKeptCents > 0 && (
            <p className="muted small-text">
              {formatPrice(history.depositsKeptCents)} in deposits kept from cancelled visits.
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
                    </span>
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

          {history.visits === 0 && history.upcoming.length === 0 && history.cancelled === 0 && (
            <p className="muted small-text">No bookings yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

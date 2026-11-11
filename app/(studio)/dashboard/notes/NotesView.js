"use client";

// The Notes tab: by client (default) or by day. Slim rows; tapping one opens
// the visits in the shared panel, where the note, the amount owed and how the
// visit went can be changed.
import { useEffect, useMemo, useState } from "react";
import { clockTime, formatDate, parseDateString } from "@/lib/availability";
import { formatPrice } from "@/lib/money";
import { outcomeLabel } from "@/lib/outcomes";
import RegularStar from "@/components/RegularStar";
import Sheet from "@/components/Sheet";
import OutcomePicker from "../wrapup/OutcomePicker";
import VisitNoteForm from "./VisitNoteForm";

const OUTCOME_CLASS = { completed_paid: "paid", completed_owed: "unpaid", no_show: "blocked", replaced: "" };

// "Tue, Nov 10" (the year only when it isn't this year's).
function shortDate(text, today) {
  const day = parseDateString(text);
  return day.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(text.slice(0, 4) !== today.slice(0, 4) && { year: "numeric" }),
  });
}

function OutcomeBadge({ outcome }) {
  if (!outcome) return <span className="badge row-badge">Not marked</span>;
  return <span className={`badge row-badge ${OUTCOME_CLASS[outcome]}`}>{outcomeLabel(outcome)}</span>;
}

// Totals for one client's visits.
function summarize(key, visits) {
  const first = visits[0];
  const s = {
    key,
    name: first.clientName,
    status: first.status,
    visits,
    kept: 0,
    noShows: 0,
    owedVisits: 0,
    owedCents: 0,
    owedUnknown: 0,
    notes: 0,
    last: first.date,
  };
  for (const v of visits) {
    if (v.outcome === "no_show") s.noShows += 1;
    else if (v.outcome !== "replaced") s.kept += 1;
    if (v.outcome === "completed_owed") {
      s.owedVisits += 1;
      if (v.owedCents == null) s.owedUnknown += 1;
      else s.owedCents += v.owedCents;
    }
    if (v.note) s.notes += 1;
  }
  return s;
}

function owedText(s) {
  if (!s.owedVisits) return null;
  if (s.owedCents > 0) return `${formatPrice(s.owedCents)} owed${s.owedUnknown ? "+" : ""}`;
  return s.owedVisits === 1 ? "Balance owed" : `${s.owedVisits} balances owed`;
}

function Chevron() {
  return (
    <svg className="client-row-chevron" width="8" height="14" viewBox="0 0 8 14" aria-hidden="true">
      <path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

// One visit, in full, inside the panel.
function VisitBlock({ visit: v, today, showClient }) {
  return (
    <li className="note-visit">
      <div className="note-visit-head">
        <strong>
          {showClient ? v.clientName : shortDate(v.date, today)}
        </strong>
        <OutcomeBadge outcome={v.outcome} />
      </div>
      <p className="muted small-text">
        {showClient ? `${shortDate(v.date, today)} · ` : ""}
        {clockTime(v.start)} · {v.service} · {formatPrice(v.priceCents)}
        {v.depositCents > 0 && ` · ${formatPrice(v.depositCents)} deposit paid`}
      </p>
      <VisitNoteForm
        bookingId={v.id}
        note={v.note}
        owedCents={v.owedCents}
        owed={v.outcome === "completed_owed"}
      />
      <details className="note-visit-outcome">
        <summary>{v.outcome ? "Change how it went" : "Mark how it went"}</summary>
        <OutcomePicker bookingId={v.id} outcome={v.outcome} clientName={v.clientName} />
      </details>
    </li>
  );
}

const FILTERS = [
  { value: "all", label: "All" },
  { value: "owed", label: "Balance owed" },
  { value: "noshow", label: "No-shows" },
  { value: "notes", label: "With notes" },
  { value: "unmarked", label: "Not marked" },
];

function visitMatches(v, filter) {
  if (filter === "owed") return v.outcome === "completed_owed";
  if (filter === "noshow") return v.outcome === "no_show";
  if (filter === "notes") return Boolean(v.note);
  if (filter === "unmarked") return !v.outcome;
  return true;
}

export default function NotesView({ visits, cardNotes, today }) {
  const [mode, setMode] = useState("client");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  // { kind: "client" | "visit", key }
  const [open, setOpen] = useState(null);

  const clients = useMemo(() => {
    const groups = new Map();
    for (const v of visits) {
      if (!groups.has(v.clientKey)) groups.set(v.clientKey, []);
      groups.get(v.clientKey).push(v);
    }
    return [...groups.entries()].map(([key, list]) => summarize(key, list));
  }, [visits]);

  const query = search.trim().toLowerCase();
  const nameMatches = (name) => !query || String(name).toLowerCase().includes(query);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, visits.filter((v) => visitMatches(v, f.value)).length]));

  const shownClients = clients.filter((c) => nameMatches(c.name) && c.visits.some((v) => visitMatches(v, filter)));
  const shownVisits = visits.filter((v) => nameMatches(v.clientName) && visitMatches(v, filter));
  const days = [];
  for (const v of shownVisits) {
    const last = days[days.length - 1];
    if (last && last.date === v.date) last.visits.push(v);
    else days.push({ date: v.date, visits: [v] });
  }

  const openClient = open?.kind === "client" ? clients.find((c) => c.key === open.key) : null;
  const openVisit = open?.kind === "visit" ? visits.find((v) => v.id === open.key) : null;
  useEffect(() => {
    if (open && !openClient && !openVisit) setOpen(null);
  }, [open, openClient, openVisit]);

  if (visits.length === 0) {
    return (
      <p className="muted">
        No finished visits yet. After a visit, mark how it went on Wrap up visits and add a note; it
        shows here.
      </p>
    );
  }

  return (
    <>
      <div className="notes-tools">
        <div className="segmented notes-mode" role="group" aria-label="Show notes">
          {[
            { value: "client", label: "By client" },
            { value: "day", label: "By day" },
          ].map((m) => (
            <button
              key={m.value}
              type="button"
              className={`segment${mode === m.value ? " checked" : ""}`}
              aria-pressed={mode === m.value}
              onClick={() => setMode(m.value)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          className="search"
          placeholder="Search by client name"
          aria-label="Search by client name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="filter-chips">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={filter === f.value ? "chip active" : "chip"}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.label} ({counts[f.value]})
          </button>
        ))}
      </div>

      {mode === "client" ? (
        shownClients.length === 0 ? (
          <p className="muted">No clients match. Try a different search or filter.</p>
        ) : (
          <ul className="client-rows">
            {shownClients.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  className="client-row notes-client-row"
                  onClick={() => setOpen({ kind: "client", key: c.key })}
                  aria-haspopup="dialog"
                >
                  <span className="client-row-main">
                    <span className="client-row-name">
                      <span className="client-row-text">{c.name}</span>
                      {c.status === "regular" && <RegularStar label="Regular" size={10} />}
                    </span>
                    <span className="client-row-phone">
                      Last booked {shortDate(c.last, today)}
                      {c.kept > 0 && ` · ${c.kept === 1 ? "1 visit" : `${c.kept} visits`}`}
                      {c.notes > 0 && ` · ${c.notes === 1 ? "1 note" : `${c.notes} notes`}`}
                    </span>
                  </span>
                  <span className="booking-row-badges">
                    {owedText(c) && <span className="badge unpaid row-badge">{owedText(c)}</span>}
                    {c.noShows > 0 && (
                      <span className="badge blocked row-badge">
                        {c.noShows === 1 ? "1 no-show" : `${c.noShows} no-shows`}
                      </span>
                    )}
                  </span>
                  <Chevron />
                </button>
              </li>
            ))}
          </ul>
        )
      ) : days.length === 0 ? (
        <p className="muted">No visits match. Try a different search or filter.</p>
      ) : (
        <ul className="day-list">
          {days.map((day) => (
            <li key={day.date} className="day-group">
              <div className="day-heading">
                <strong>{day.date === today ? `Today · ${formatDate(day.date)}` : formatDate(day.date)}</strong>
                <span className="muted small-text">
                  {day.visits.length === 1 ? "1 visit" : `${day.visits.length} visits`}
                </span>
              </div>
              <ul className="client-rows">
                {day.visits.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      className="client-row booking-row"
                      onClick={() => setOpen({ kind: "visit", key: v.id })}
                      aria-haspopup="dialog"
                    >
                      <span className="booking-row-time">
                        <strong>{clockTime(v.start)}</strong>
                        <span>{clockTime(v.end)}</span>
                      </span>
                      <span className="client-row-main">
                        <span className="client-row-name">
                          <span className="client-row-text">{v.clientName}</span>
                          {v.status === "regular" && <RegularStar label="Regular" size={10} />}
                        </span>
                        <span className="client-row-phone">{v.note ? v.note : v.service}</span>
                      </span>
                      <span className="booking-row-badges">
                        {v.outcome === "completed_owed" && v.owedCents != null ? (
                          <span className="badge unpaid row-badge">{formatPrice(v.owedCents)} owed</span>
                        ) : (
                          <OutcomeBadge outcome={v.outcome} />
                        )}
                      </span>
                      <Chevron />
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {openClient && (
        <Sheet key={`c|${openClient.key}`} label={openClient.name} backLabel="Notes" onClose={() => setOpen(null)}>
          <div className="client-card">
            <div className="client-top">
              <div className="client-name">{openClient.name}</div>
              {openClient.status === "regular" && (
                <span className="badge regular">
                  <RegularStar label={null} /> Regular
                </span>
              )}
            </div>
            <dl className="booking-facts">
              <div>
                <dt>Visits</dt>
                <dd>
                  {openClient.kept}
                  {openClient.noShows > 0 &&
                    ` · ${openClient.noShows === 1 ? "1 no-show" : `${openClient.noShows} no-shows`}`}
                </dd>
              </div>
              {openClient.owedVisits > 0 && (
                <div>
                  <dt>Owed</dt>
                  <dd>
                    {openClient.owedCents > 0 ? formatPrice(openClient.owedCents) : "Amount not written down"}
                    {openClient.owedCents > 0 && openClient.owedUnknown > 0 && " + amounts not written down"}
                  </dd>
                </div>
              )}
              {cardNotes[openClient.key] && (
                <div>
                  <dt>Card notes</dt>
                  <dd className="visit-note-text">{cardNotes[openClient.key]}</dd>
                </div>
              )}
            </dl>
            <ul className="note-visits">
              {openClient.visits.map((v) => (
                <VisitBlock key={v.id} visit={v} today={today} />
              ))}
            </ul>
          </div>
        </Sheet>
      )}

      {openVisit && (
        <Sheet key={`v|${openVisit.id}`} label={openVisit.clientName} backLabel="Notes" onClose={() => setOpen(null)}>
          <div className="client-card">
            <ul className="note-visits">
              <VisitBlock visit={openVisit} today={today} showClient />
            </ul>
          </div>
        </Sheet>
      )}
    </>
  );
}

"use client";

// "Your clients": search, filters, then one slim row per client (name,
// phone, Regular/Invited, next appointment). Tapping a row opens the full
// card in a panel: full screen on a phone, centered on iPad and computer.
import { useEffect, useMemo, useRef, useState } from "react";
import { CLIENT_STATUSES, findDuplicatePairs } from "@/lib/clients";
import { clockTime, parseDateString } from "@/lib/availability";
import { displayPhone } from "@/lib/phone";
import ClientCard from "./ClientCard";
import RegularStar from "@/components/RegularStar";

// Lowercase, and also keep just the digits so "555-1234" matches "5551234".
function matches(client, search) {
  const text = [client.name, client.phone, client.email, client.notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (text.includes(search)) return true;

  const searchDigits = search.replace(/\D/g, "");
  const phoneDigits = (client.phone || "").replace(/\D/g, "");
  return searchDigits.length >= 3 && phoneDigits.includes(searchDigits);
}

// "Today, 2:00 PM", "Tomorrow, 9:30 AM", "Tue, Nov 18, 2:00 PM".
function nextVisitText(visit, today) {
  const time = clockTime(visit.time);
  const day = parseDateString(visit.date);
  const diff = Math.round((day - parseDateString(today)) / 86400000);
  if (diff === 0) return `Today, ${time}`;
  if (diff === 1) return `Tomorrow, ${time}`;
  const date = day.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(day.getFullYear() !== parseDateString(today).getFullYear() && { year: "numeric" }),
  });
  return `${date}, ${time}`;
}

function ClientRow({ client, next, today, duplicate, onOpen }) {
  return (
    <li>
      <button type="button" className="client-row" onClick={onOpen} aria-haspopup="dialog">
        <span className="client-row-main">
          <span className="client-row-name">
            <span className="client-row-text">{client.name}</span>
            {client.status === "regular" && (
              <span className="badge regular row-badge">
                <RegularStar label={null} size={9} /> Regular
              </span>
            )}
            {client.status === "blocked" && <span className="badge blocked row-badge">Blocked</span>}
            {client.invited_at && <span className="badge invited row-badge">Invited</span>}
            {duplicate && (
              <span className="dup-dot" title="Possible duplicate" aria-label="Possible duplicate" />
            )}
          </span>
          <span className="client-row-phone">
            {client.phone ? displayPhone(client.phone) : client.email || "No phone"}
          </span>
        </span>
        <span className={next ? "client-row-next" : "client-row-next none"}>
          {next ? (
            <>
              <span className="client-row-next-label">Next</span>
              {nextVisitText(next, today)}
            </>
          ) : (
            "No upcoming visit"
          )}
        </span>
        <svg className="client-row-chevron" width="8" height="14" viewBox="0 0 8 14" aria-hidden="true">
          <path d="M1 1l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </li>
  );
}

// The full card in a <dialog>: Esc, the close button or tapping outside closes it.
function ClientSheet({ client, mergeWith, onClose, ...cardProps }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="client-sheet"
      aria-label={client.name}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
    >
      <div className="client-sheet-inner">
        <div className="client-sheet-bar">
          <button type="button" className="link-button" onClick={() => ref.current?.close()}>
            ‹ All clients
          </button>
        </div>
        <ClientCard client={client} mergeWith={mergeWith} {...cardProps} />
      </div>
    </dialog>
  );
}

export default function ClientList({ clients, standing, nextVisits = {}, upcomingCounts = {} }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  // The open card: { id, mergeWith } or null.
  const [open, setOpen] = useState(null);

  // "Invited" isn't a status: invited clients are New (or Regular later).
  const inFilter = (c, value) =>
    value === "all" || (value === "invited" ? Boolean(c.invited_at) : c.status === value);

  const filters = [{ value: "all", label: "All" }, ...CLIENT_STATUSES];
  if (clients.some((c) => c.invited_at)) filters.push({ value: "invited", label: "Invited" });

  const counts = {};
  for (const f of filters) counts[f.value] = clients.filter((c) => inFilter(c, f.value)).length;

  const query = search.trim().toLowerCase();
  const shown = clients.filter((c) => inFilter(c, filter) && (!query || matches(c, query)));

  const duplicatePairs = useMemo(() => findDuplicatePairs(clients), [clients]);
  const duplicateIds = useMemo(
    () => new Set(duplicatePairs.flatMap((p) => [p.a.id, p.b.id])),
    [duplicatePairs]
  );

  // The open card was deleted or merged away: close the panel.
  const openClient = open ? clients.find((c) => c.id === open.id) : null;
  useEffect(() => {
    if (open && !openClient) setOpen(null);
  }, [open, openClient]);

  return (
    <>
      <input
        type="search"
        className="search"
        placeholder="Search clients"
        aria-label="Search clients"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="filter-chips">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            className={filter === f.value ? "chip active" : "chip"}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
          >
            {f.value === "regular" && (
              <>
                <RegularStar label={null} />{" "}
              </>
            )}
            {f.label} ({counts[f.value]})
          </button>
        ))}
      </div>

      {duplicatePairs.length > 0 && (
        <details className="dup-notice">
          <summary>
            <span className="dup-dot" aria-hidden="true" />
            {duplicatePairs.length === 1
              ? "1 possible duplicate"
              : `${duplicatePairs.length} possible duplicates`}
          </summary>
          <p className="muted small-text">
            These cards share an email or phone number. If they&apos;re the same person, merge them.
          </p>
          <ul className="dup-list">
            {duplicatePairs.map(({ a, b, reason }) => (
              <li key={`${a.id}|${b.id}`}>
                <span>
                  <strong>{a.name}</strong> &amp; <strong>{b.name}</strong>
                  <span className="muted small-text"> · {reason}</span>
                </span>
                <button
                  type="button"
                  className="button small secondary"
                  onClick={() => setOpen({ id: a.id, mergeWith: b.id })}
                >
                  Review
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {clients.length === 0 && <p className="muted">No clients yet. Add your first one above.</p>}
      {clients.length > 0 && shown.length === 0 && (
        <p className="muted">No clients match. Try a different search or filter.</p>
      )}

      <ul className="client-rows">
        {shown.map((client) => (
          <ClientRow
            key={client.id}
            client={client}
            next={nextVisits[client.id]}
            today={standing?.today}
            duplicate={duplicateIds.has(client.id)}
            onOpen={() => setOpen({ id: client.id, mergeWith: null })}
          />
        ))}
      </ul>

      {openClient && (
        <ClientSheet
          key={`${open.id}|${open.mergeWith || ""}`}
          client={openClient}
          mergeWith={open.mergeWith}
          onClose={() => setOpen(null)}
          standing={standing}
          clients={clients}
          upcomingCounts={upcomingCounts}
        />
      )}
    </>
  );
}

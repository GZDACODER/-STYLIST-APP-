"use client";

// "Your clients": search, filters, then one slim row per client (name,
// phone, Regular/Invited, next appointment). Tapping a row opens the full
// card in a panel: full screen on a phone, centered on iPad and computer.
import EmptyState from "@/components/dash/EmptyState";
import ShowMore from "@/components/dash/ShowMore";
import { useEffect, useMemo, useState } from "react";
import { CLIENT_STATUSES, findDuplicateGroups } from "@/lib/clients";
import { clockTime, parseDateString } from "@/lib/availability";
import { displayPhone } from "@/lib/phone";
import ClientCard from "./ClientCard";
import RegularStar from "@/components/RegularStar";
import Sheet from "@/components/Sheet";
import { ExampleCard, ExampleTag } from "@/components/dash/Example";
import Words from "@/components/Words";

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
      <button type="button" className={client.example ? "client-row is-example" : "client-row"} onClick={onOpen} aria-haspopup="dialog">
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
            {client.example && <ExampleTag />}
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

// examples: example clients (lib/examples.js), shown only while there are
// no real ones.
export default function ClientList({ clients: realClients, standing, nextVisits = {}, upcomingCounts = {}, examples = [] }) {
  const exampleMode = realClients.length === 0 && examples.length > 0;
  const clients = exampleMode ? examples : realClients;
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

  const duplicateGroups = useMemo(() => findDuplicateGroups(clients), [clients]);
  const duplicateIds = useMemo(
    () => new Set(duplicateGroups.flatMap((g) => g.clients.map((c) => c.id))),
    [duplicateGroups]
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

      {duplicateGroups.length > 0 && (
        <details className="dup-notice">
          <summary>
            <span className="dup-dot" aria-hidden="true" />
            {duplicateGroups.length === 1
              ? "1 client may have more than one card"
              : `${duplicateGroups.length} clients may have more than one card`}
          </summary>
          <p className="muted small-text">
            These cards share an email or phone number. If they&apos;re the same person, merge them.
            Review merges two at a time; review again if there are more.
          </p>
          <ul className="dup-list">
            {duplicateGroups.map(({ clients: group, reason }) => (
              <li key={group.map((c) => c.id).join("|")}>
                <span>
                  {group.map((c, i) => (
                    <span key={c.id}>
                      {i > 0 && (i === group.length - 1 ? " & " : ", ")}
                      <strong>{c.name}</strong>
                    </span>
                  ))}
                  <span className="muted small-text">
                    {" "}
                    · {group.length} cards · {reason}
                  </span>
                </span>
                <button
                  type="button"
                  className="button small secondary"
                  onClick={() => setOpen({ id: group[0].id, mergeWith: group[1].id })}
                >
                  Review
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {exampleMode && (
        <p className="examples-note">
          <Words>{"These are example clients. Add your own (or take your first booking) and they'll go away."}</Words>
        </p>
      )}
      {clients.length === 0 && (
        <EmptyState
          title="No clients yet"
          text="Clients appear here when they book, or add them yourself."
          action={
            <a href="/dashboard/clients?add=client#add-client" className="button small">
              <Words>+ Add client</Words>
            </a>
          }
        />
      )}
      {clients.length > 0 && shown.length === 0 && (
        <EmptyState title="No clients match" text="Try a different search or filter." />
      )}

      <ShowMore className="client-rows" noun="more clients" key={`${filter}|${query}`}>
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
      </ShowMore>

      {openClient?.example && (
        <Sheet key={openClient.id} label={openClient.name} backLabel="All clients" onClose={() => setOpen(null)}>
          <ExampleCard
            title={openClient.name}
            facts={[
              ["Status", openClient.invited_at ? "Invited (private link sent)" : openClient.status === "regular" ? "Regular" : "New"],
              ["Phone", displayPhone(openClient.phone)],
              ["Email", openClient.email],
              ["Visits", String(openClient.visits)],
              ["Next visit", nextVisits[openClient.id] ? nextVisitText(nextVisits[openClient.id], standing?.today) : "None booked"],
              ["Notes", openClient.notes],
            ]}
            addHref="/dashboard/clients?add=client#add-client"
            addLabel="+ Add your own client"
          >
            {openClient.intake && (
              <div className="example-intake">
                <h3 className="list-title">Intake form</h3>
                <dl className="booking-facts">
                  {openClient.intake.answers.map(([q, a]) => (
                    <div key={q}>
                      <dt>{q}</dt>
                      <dd>{a}</dd>
                    </div>
                  ))}
                  <div>
                    <dt>Waiver</dt>
                    <dd>Signed by {openClient.intake.signed}</dd>
                  </div>
                </dl>
              </div>
            )}
          </ExampleCard>
        </Sheet>
      )}
      {openClient && !openClient.example && (
        <Sheet
          key={`${open.id}|${open.mergeWith || ""}`}
          label={openClient.name}
          backLabel="All clients"
          onClose={() => setOpen(null)}
        >
          <ClientCard
            client={openClient}
            mergeWith={open.mergeWith}
            standing={standing}
            clients={clients}
            upcomingCounts={upcomingCounts}
          />
        </Sheet>
      )}
    </>
  );
}

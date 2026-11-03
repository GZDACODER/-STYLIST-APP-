"use client";

import { useState } from "react";
import { CLIENT_STATUSES } from "@/lib/clients";
import ClientCard from "./ClientCard";

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

export default function ClientList({ clients }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  // "Invited" isn't a status: invited clients are New (or Regular later).
  const inFilter = (c, value) =>
    value === "all" || (value === "invited" ? Boolean(c.invited_at) : c.status === value);

  const filters = [{ value: "all", label: "All" }, ...CLIENT_STATUSES];
  if (clients.some((c) => c.invited_at)) filters.push({ value: "invited", label: "Invited" });

  const counts = {};
  for (const f of filters) counts[f.value] = clients.filter((c) => inFilter(c, f.value)).length;

  const query = search.trim().toLowerCase();
  const shown = clients.filter((c) => inFilter(c, filter) && (!query || matches(c, query)));

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
            {f.label} ({counts[f.value]})
          </button>
        ))}
      </div>

      {clients.length === 0 && <p className="muted">No clients yet. Add your first one above.</p>}
      {clients.length > 0 && shown.length === 0 && (
        <p className="muted">No clients match. Try a different search or filter.</p>
      )}

      <ul className="client-list">
        {shown.map((client) => (
          <ClientCard key={client.id} client={client} />
        ))}
      </ul>
    </>
  );
}

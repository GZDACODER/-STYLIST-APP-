"use client";

// "Merge with another card" on a client's card: pick the other card for the
// same person, choose which name, phone and email to keep, confirm, and
// everything (visits, upcoming visits, deposits, standing appointments,
// notes, Regular status) ends up on this card. The other card is deleted.
import { useMemo, useState, useTransition } from "react";
import { mergeClients } from "./actions";
import { duplicateReason } from "@/lib/clients";
import { displayPhone } from "@/lib/phone";
import RegularStar from "@/components/RegularStar";

const STATUS_LABEL = { regular: "Regular", new: "New", blocked: "Blocked" };

const same = (x, y) => String(x || "").trim().toLowerCase() === String(y || "").trim().toLowerCase();
const visitsText = (n) => (n === 1 ? "1 visit" : `${n || 0} visits`);

function mergedStatus(a, b) {
  if (a.status === "blocked" || b.status === "blocked") return "blocked";
  if (a.status === "regular" || b.status === "regular") return "regular";
  return "new";
}

function mergedNotes(a, b) {
  const x = String(a.notes || "").trim();
  const y = String(b.notes || "").trim();
  if (!y || x === y) return x;
  return x ? `${x}\n\n${y}` : y;
}

// One "keep which?" question. Only asked when the two cards differ and both
// have something; otherwise the one that has a value wins.
function Choice({ label, name, options, value, onChange }) {
  return (
    <fieldset className="merge-choice">
      <legend>{label}</legend>
      {options.map((o) => (
        <label key={o.value} className={value === o.value ? "merge-option checked" : "merge-option"}>
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          <span>{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export default function MergeClients({ client, clients, standing, upcomingCounts, initialOtherId }) {
  const [open, setOpen] = useState(Boolean(initialOtherId));
  const [otherId, setOtherId] = useState(initialOtherId || null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [merged, setMerged] = useState(null);
  const [pending, startTransition] = useTransition();

  const others = useMemo(() => clients.filter((c) => c.id !== client.id), [clients, client.id]);
  const other = others.find((c) => c.id === otherId) || null;

  // Possible duplicates first, then everyone else that matches the search.
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, "");
    const list = others
      .map((c) => ({ c, reason: duplicateReason(client, c) }))
      .filter(({ c, reason }) => {
        if (!q) return Boolean(reason) || same(c.name, client.name);
        const text = [c.name, c.email].filter(Boolean).join(" ").toLowerCase();
        const digits = String(c.phone || "").replace(/\D/g, "");
        return text.includes(q) || (qDigits.length >= 3 && digits.includes(qDigits));
      });
    list.sort((x, y) => Number(Boolean(y.reason)) - Number(Boolean(x.reason)));
    return list.slice(0, 8);
  }, [others, search, client]);

  const [name, setName] = useState(null);
  const [phone, setPhone] = useState(null);
  const [email, setEmail] = useState(null);

  function pick(id) {
    setOtherId(id);
    setName(null);
    setPhone(null);
    setEmail(null);
    setError(null);
  }

  function close() {
    setOpen(false);
    setOtherId(null);
    setSearch("");
    setError(null);
  }

  if (!open) {
    return (
      <div className="merge-entry">
        {merged && <p className="message success">Merged. Everything from {merged} is on this card now.</p>}
        <button
          type="button"
          className="link-button quiet-link"
          onClick={() => {
            setMerged(null);
            setOpen(true);
          }}
        >
          Merge with another card
        </button>
      </div>
    );
  }

  // ---- Step 1: which card? ----
  if (!other) {
    return (
      <div className="merge-panel">
        <div className="merge-head">
          <h3>Merge with another card</h3>
          <button type="button" className="link-button" onClick={close}>
            Cancel
          </button>
        </div>
        <p className="muted small-text">
          Pick the other card for {client.name}. Everything on it moves to this card.
        </p>
        <input
          type="search"
          className="search"
          placeholder="Search by name, phone or email"
          aria-label="Search for the other card"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {candidates.length === 0 ? (
          <p className="muted small-text">
            {search.trim()
              ? "No other cards match."
              : "No cards share this name, email or phone. Search for the other card above."}
          </p>
        ) : (
          <ul className="merge-candidates">
            {candidates.map(({ c, reason }) => (
              <li key={c.id}>
                <button type="button" className="merge-candidate" onClick={() => pick(c.id)}>
                  <span className="merge-candidate-name">
                    {c.name}
                    {c.status === "regular" && <RegularStar label="Regular" />}
                  </span>
                  <span className="merge-candidate-meta">
                    {[c.phone && displayPhone(c.phone), c.email].filter(Boolean).join(" · ") || "No phone or email"}
                  </span>
                  {reason && <span className="badge dup">{reason}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // ---- Step 2: choose what to keep, then confirm ----
  const nameOptions = same(client.name, other.name)
    ? null
    : [
        { value: "this", label: client.name },
        { value: "other", label: other.name },
      ];
  const phoneOptions =
    client.phone && other.phone && displayPhone(client.phone) !== displayPhone(other.phone)
      ? [
          { value: "this", label: displayPhone(client.phone) },
          { value: "other", label: displayPhone(other.phone) },
        ]
      : null;
  const emailOptions =
    client.email && other.email && !same(client.email, other.email)
      ? [
          { value: "this", label: client.email },
          { value: "other", label: other.email },
        ]
      : null;

  const chosenName = name === "other" ? other.name : client.name;
  const chosenPhone = phoneOptions ? (phone === "other" ? other.phone : client.phone) : client.phone || other.phone;
  const chosenEmail = emailOptions ? (email === "other" ? other.email : client.email) : client.email || other.email;

  const status = mergedStatus(client, other);
  const notes = mergedNotes(client, other);
  const series = standing?.series || [];
  const standingCount = series.filter((s) => s.client_id === client.id || s.client_id === other.id).length;
  const clash = series.some(
    (a) =>
      a.client_id === client.id &&
      series.some((b) => b.client_id === other.id && b.weekday === a.weekday && b.start_time === a.start_time)
  );
  const upcoming = (upcomingCounts?.[client.id] || 0) + (upcomingCounts?.[other.id] || 0);
  const visits = (client.completed_visits || 0) + (other.completed_visits || 0);
  const notesTooLong = notes.length > 1000;
  const blockedFromOther = status === "blocked" && client.status !== "blocked";

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await mergeClients({
        keepId: client.id,
        removeId: other.id,
        name: chosenName,
        phone: chosenPhone,
        email: chosenEmail,
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      setMerged(other.name);
      close();
    });
  }

  return (
    <div className="merge-panel">
      <div className="merge-head">
        <h3>Merge {other.name} into this card</h3>
        <button type="button" className="link-button" onClick={close} disabled={pending}>
          Cancel
        </button>
      </div>

      <div className="merge-pair">
        <div>
          <span className="merge-label">Keeping</span>
          <strong>{client.name}</strong>
          <span className="muted small-text">
            {visitsText(client.completed_visits)} · {STATUS_LABEL[client.status]}
          </span>
        </div>
        <div>
          <span className="merge-label">Merging in</span>
          <strong>{other.name}</strong>
          <span className="muted small-text">
            {visitsText(other.completed_visits)} · {STATUS_LABEL[other.status]}
          </span>
        </div>
      </div>

      {nameOptions && (
        <Choice label="Name to keep" name="merge-name" options={nameOptions} value={name || "this"} onChange={setName} />
      )}
      {phoneOptions && (
        <Choice
          label="Phone to keep"
          name="merge-phone"
          options={phoneOptions}
          value={phone || "this"}
          onChange={setPhone}
        />
      )}
      {emailOptions && (
        <Choice
          label="Email to keep"
          name="merge-email"
          options={emailOptions}
          value={email || "this"}
          onChange={setEmail}
        />
      )}

      <div className="merge-summary">
        <p className="merge-label">After merging, this card will have</p>
        <ul>
          <li>
            <strong>{chosenName}</strong>
            {chosenPhone ? ` · ${displayPhone(chosenPhone)}` : ""}
            {chosenEmail ? ` · ${chosenEmail}` : ""}
          </li>
          <li>All visit history from both cards ({visitsText(visits)}), including deposits</li>
          {upcoming > 0 && <li>{upcoming === 1 ? "1 upcoming appointment" : `${upcoming} upcoming appointments`}</li>}
          {standingCount > 0 && (
            <li>{standingCount === 1 ? "1 standing appointment" : `${standingCount} standing appointments`}</li>
          )}
          {notes && <li>Notes from both cards</li>}
          <li>
            Status: {status === "regular" && <RegularStar label={null} />} {STATUS_LABEL[status]}
          </li>
        </ul>
        {blockedFromOther && (
          <p className="message warning">
            {other.name}&apos;s card is Blocked, so the merged card will be Blocked too. You can change it after.
          </p>
        )}
      </div>

      {clash && (
        <p className="message error">
          Both cards have a standing appointment on the same day and time. End one of them first, then merge.
        </p>
      )}
      {notesTooLong && (
        <p className="message error">
          Together, their notes are over 1000 characters. Shorten the notes on one card first, then merge.
        </p>
      )}

      <p className="confirm-question">
        Merge these two cards? {other.name}&apos;s card will be removed. This can&apos;t be undone.
      </p>
      <div className="confirm-actions">
        <button type="button" className="button small" onClick={() => pick(null)} disabled={pending}>
          Back
        </button>
        <button
          type="button"
          className="button small secondary"
          onClick={confirm}
          disabled={pending || clash || notesTooLong}
        >
          {pending ? "Merging..." : "Yes, merge"}
        </button>
      </div>
      {error && <p className="message error">{error}</p>}
    </div>
  );
}

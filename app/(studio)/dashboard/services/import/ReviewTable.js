"use client";

// Check what we read: fix, delete or add rows. Flags: no time (fill it in),
// no price, already on your page, listed twice. Nothing is added until
// "Approve and add to my page".
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { flagRows } from "@/lib/serviceImport";
import { approveImport } from "./actions";

const FLAG = {
  no_time: { text: "Add a time", tone: "warn" },
  no_price: { text: "Add a price", tone: "warn" },
  on_page: { text: "Already on your page", tone: "dup" },
  twice: { text: "Listed twice", tone: "dup" },
};

let n = 0;
const blank = () => ({ key: `new${Date.now()}${n++}`, name: "", price: "", duration: "", category: "", description: "" });

export default function ReviewTable({ importId, initialRows, existingNames }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows.map(({ flags, ...r }) => r));
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  const flagged = useMemo(() => flagRows(rows, existingNames), [rows, existingNames]);
  const errorOf = Object.fromEntries(errors.filter((e) => e.key).map((e) => [e.key, e.message]));
  const general = errors.filter((e) => !e.key);
  const dups = flagged.filter((r) => r.flags.includes("on_page") || r.flags.includes("twice")).length;
  const missing = flagged.filter((r) => r.flags.includes("no_time") || r.flags.includes("no_price")).length;

  const set = (key, field, value) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const del = (key) => setRows((rs) => rs.filter((r) => r.key !== key));

  async function approve() {
    setSaving(true);
    setErrors([]);
    const result = await approveImport(importId, rows);
    if (result?.errors || result?.error) {
      setErrors(result.errors || [{ key: null, message: result.error }]);
      setSaving(false);
      return;
    }
    router.push(`/dashboard/services/import?id=${importId}`);
    router.refresh();
  }

  return (
    <section className="card si-review">
      <h2>
        We found {rows.length} {rows.length === 1 ? "service" : "services"}
      </h2>
      <p className="muted">
        Check each one, fix anything we got wrong, and fill in what&apos;s missing.
        {missing > 0 && <> <strong>{missing} need a time or price.</strong></>}
        {dups > 0 && <> {dups} look like duplicates: delete them if you don&apos;t want two.</>}
      </p>

      <div className="si-table" role="table" aria-label="Services to add">
        <div className="si-row si-head" role="row">
          <span role="columnheader">Service</span>
          <span role="columnheader">Price ($)</span>
          <span role="columnheader">Minutes</span>
          <span role="columnheader">Category</span>
          <span role="columnheader">Description</span>
          <span role="columnheader" className="visually-hidden">Delete</span>
        </div>
        {flagged.map((r, i) => (
          <div key={r.key} className={`si-row${errorOf[r.key] ? " has-error" : ""}`} role="row">
            <label className="si-cell si-name">
              <span className="si-label">Service</span>
              <input value={r.name} maxLength={80} onChange={(e) => set(r.key, "name", e.target.value)} aria-label={`Service ${i + 1} name`} placeholder="Service name" />
              {r.flags.length > 0 && (
                <span className="si-flags">
                  {r.flags.map((f) => (
                    <span key={f} className={`si-flag is-${FLAG[f].tone}`}>{FLAG[f].text}</span>
                  ))}
                </span>
              )}
            </label>
            <label className="si-cell">
              <span className="si-label">Price ($)</span>
              <input inputMode="decimal" value={r.price} onChange={(e) => set(r.key, "price", e.target.value)} aria-label={`Service ${i + 1} price`} placeholder="0" className={r.price === "" ? "is-missing" : ""} />
            </label>
            <label className="si-cell">
              <span className="si-label">Minutes</span>
              <input inputMode="numeric" value={r.duration} onChange={(e) => set(r.key, "duration", e.target.value.replace(/[^0-9]/g, ""))} aria-label={`Service ${i + 1} minutes`} placeholder="e.g. 60" className={r.duration === "" ? "is-missing" : ""} />
            </label>
            <label className="si-cell">
              <span className="si-label">Category</span>
              <input value={r.category} maxLength={60} onChange={(e) => set(r.key, "category", e.target.value)} aria-label={`Service ${i + 1} category`} />
            </label>
            <label className="si-cell si-desc">
              <span className="si-label">Description</span>
              <input value={r.description} maxLength={300} onChange={(e) => set(r.key, "description", e.target.value)} aria-label={`Service ${i + 1} description`} />
            </label>
            <button type="button" className="si-del" onClick={() => del(r.key)} aria-label={`Delete ${r.name || `service ${i + 1}`}`}>
              Delete
            </button>
            {errorOf[r.key] && <p className="si-row-error">{errorOf[r.key]}</p>}
          </div>
        ))}
      </div>

      <button type="button" className="button secondary small si-add" onClick={() => setRows((rs) => [...rs, blank()])}>
        + Add a service
      </button>

      {general.map((e, i) => (
        <p key={i} className="message error">{e.message}</p>
      ))}
      {errors.some((e) => e.key) && <p className="message error">Fix the services marked in red, then try again.</p>}

      <div className="si-approve">
        <button type="button" className="button" onClick={approve} disabled={saving || rows.length === 0}>
          {saving ? "Adding…" : `Approve and add to my page (${rows.length})`}
        </button>
        <p className="muted small-text">Categories and descriptions are kept with your import for reference.</p>
      </div>
    </section>
  );
}

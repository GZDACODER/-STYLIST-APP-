"use client";

// "Import clients": a CSV file exported from another booking app. The file
// is read here in the browser; the stylist checks which column is which,
// then the clients are added (anyone already on the list is skipped).
import { useState, useTransition } from "react";
import { IMPORT_FIELDS, guessColumns, parseCsv, rowToClient } from "@/lib/csv";
import { importClients } from "./importActions";

export default function ImportClients() {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState({});
  const [status, setStatus] = useState("new");
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setColumns({});
    setError(null);
  }

  async function pickFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setResult(null);
    setError(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("That file is too big (over 5 MB). Please export just your clients.");
      return;
    }
    if (!/\.(csv|txt|tsv)$/i.test(file.name)) {
      setError("Please pick a .csv file. In Excel or Numbers, use File → Export → CSV.");
      return;
    }
    const all = parseCsv(await file.text());
    if (all.length < 2) {
      setError("That file doesn't have any clients in it.");
      return;
    }
    const [head, ...body] = all;
    setFileName(file.name);
    setHeaders(head);
    setRows(body);
    setColumns(guessColumns(head));
  }

  function setColumn(key, value) {
    setColumns((c) => ({ ...c, [key]: value === "" ? undefined : Number(value) }));
  }

  const clients = rows.map((r) => rowToClient(r, columns));
  const usable = clients.filter((c) => c.name && (c.phone || c.email));
  const hasName = columns.name !== undefined || columns.first !== undefined;

  function runImport() {
    setError(null);
    startTransition(async () => {
      const outcome = await importClients(usable, status);
      if (outcome.error) {
        setError(outcome.error);
        return;
      }
      setResult(outcome);
      reset();
    });
  }

  return (
    <div className="import-clients">
      {result && (
        <p className="message success">
          {result.added === 1 ? "1 client added." : `${result.added} clients added.`}
          {result.duplicates > 0 &&
            ` ${result.duplicates} ${result.duplicates === 1 ? "was" : "were"} already on your list.`}
          {result.invalid > 0 &&
            ` ${result.invalid} skipped (no name, or no phone number or email).`}
        </p>
      )}

      {!fileName && (
        <>
          <p className="muted small-text">
            Export your client list from your old booking app (Square, Vagaro, Booksy, Fresha,
            GlossGenius, StyleSeat…) as a CSV file, then pick it here. Names, phone numbers,
            emails and notes come across. Anyone already on your list is skipped.
          </p>
          <label className="button secondary small import-pick">
            Choose CSV file
            <input type="file" accept=".csv,.tsv,.txt,text/csv" onChange={pickFile} hidden />
          </label>
        </>
      )}

      {fileName && (
        <>
          <p className="small-text">
            <strong>{fileName}</strong> · {rows.length} {rows.length === 1 ? "row" : "rows"}
          </p>
          <p className="muted small-text">Check which column is which:</p>
          <div className="import-columns">
            {IMPORT_FIELDS.map((f) => (
              <label key={f.key}>
                {f.label}
                <select
                  value={columns[f.key] ?? ""}
                  onChange={(e) => setColumn(f.key, e.target.value)}
                >
                  <option value="">Not in this file</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {usable.length > 0 && (
            <div className="import-preview">
              <p className="muted small-text">First few clients:</p>
              <ul>
                {usable.slice(0, 5).map((c, i) => (
                  <li key={i}>
                    <strong>{c.name}</strong>
                    {c.phone && ` · ${c.phone}`}
                    {c.email && ` · ${c.email}`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label>
            Add them as
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="new">New</option>
              <option value="regular">Regular</option>
            </select>
          </label>
          <p className="muted small-text">
            {status === "regular"
              ? "Regulars get first pick of your openings. You can change anyone later."
              : "New clients become Regulars automatically after enough visits (see Settings)."}
          </p>

          {!hasName && <p className="message error">Please pick the name column.</p>}
          {hasName && usable.length === 0 && (
            <p className="message error">
              No rows have both a name and a phone number or email. Check the columns above.
            </p>
          )}
          {hasName && usable.length > 0 && usable.length < clients.length && (
            <p className="muted small-text">
              {clients.length - usable.length} rows have no name, or no phone number or email,
              so they&apos;ll be skipped.
            </p>
          )}

          <div className="row">
            <button type="button" className="button secondary" onClick={reset} disabled={pending}>
              Cancel
            </button>
            <button
              type="button"
              className="button"
              onClick={runImport}
              disabled={pending || !hasName || usable.length === 0}
            >
              {pending
                ? "Importing..."
                : `Import ${usable.length} ${usable.length === 1 ? "client" : "clients"}`}
            </button>
          </div>
        </>
      )}

      {error && <p className="message error">{error}</p>}
    </div>
  );
}

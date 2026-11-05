// Reading a client list exported from another booking app (a CSV file).
// Works in the browser and on the server. No outside libraries.

// Text of a CSV file -> rows of cells. Handles quoted cells ("Smith, Jo"),
// quotes inside quotes (""), line breaks inside quotes, Windows line
// endings, and files that use ; or tabs instead of commas.
export function parseCsv(text) {
  const source = String(text || "").replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] || "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (const ch of firstLine) if (ch in counts) counts[ch] += 1;
  const [best, bestCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const sep = bestCount > 0 ? best : ",";

  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Drop empty lines.
  return rows
    .map((r) => r.map((c) => c.trim()))
    .filter((r) => r.some((c) => c !== ""));
}

// The fields a column can be used for.
export const IMPORT_FIELDS = [
  { key: "name", label: "Full name" },
  { key: "first", label: "First name" },
  { key: "last", label: "Last name" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "notes", label: "Notes" },
];

// Guesses which column is which from the header row (Square, Vagaro,
// Booksy, Fresha, GlossGenius, StyleSeat... all name them a little
// differently). Returns { name: 0, phone: 3, ... } with column numbers.
export function guessColumns(headers) {
  const tests = {
    first: /^(first|given)[\s_-]*name$|^first$/i,
    last: /^(last|family|sur)[\s_-]*name$|^last$|^surname$/i,
    name: /^(full[\s_-]*name|client[\s_-]*name|customer[\s_-]*name|customer|client|name|display[\s_-]*name)$/i,
    phone: /mobile|cell/i,
    email: /e-?mail/i,
    notes: /note|memo|comment|allerg/i,
  };
  const found = {};
  headers.forEach((header, i) => {
    const h = String(header || "").trim();
    for (const [key, test] of Object.entries(tests)) {
      if (found[key] === undefined && test.test(h)) {
        found[key] = i;
        return;
      }
    }
  });
  // Any phone column, if there's no mobile/cell one.
  if (found.phone === undefined) {
    const i = headers.findIndex((h) => /phone|tel|number/i.test(String(h || "")));
    if (i >= 0) found.phone = i;
  }
  // A full name wins over first + last only when there's no first name.
  if (found.first !== undefined && found.name !== undefined && found.last !== undefined) {
    delete found.name;
  }
  return found;
}

// One row -> { name, phone, email, notes }, using the chosen columns.
export function rowToClient(row, columns) {
  const get = (key) => (columns[key] === undefined || columns[key] === "" ? "" : String(row[columns[key]] || "").trim());
  const fromParts = [get("first"), get("last")].filter(Boolean).join(" ");
  return {
    name: (get("name") || fromParts).replace(/\s+/g, " "),
    phone: get("phone"),
    email: get("email").toLowerCase(),
    notes: get("notes"),
  };
}

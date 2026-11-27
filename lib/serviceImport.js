// "We'll set it up for you": services read from screenshots of a pro's old
// menu (Booksy, GlossGenius, Square, Instagram…). The schema Claude fills,
// cleaning what it read, flags for the review table, and the final check
// before anything is added. Pure; relative imports only (npm test loads it).

import { cleanDescription } from "./serviceDescription.js";

export const IMPORT_MAX_SCREENSHOTS = 10;
export const IMPORT_MAX_ROWS = 100;
const MIN_MINUTES = 5;
const MAX_MINUTES = 600;
const MAX_PRICE_CENTS = 10000000; // $100,000

// What Claude returns (structured outputs). Prices stay as the text on the
// screenshot ("$85", "from $220", "Free"); we turn them into numbers.
export const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    services: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          price: { type: "string" },
          duration_minutes: { anyOf: [{ type: "integer" }, { type: "null" }] },
          category: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "price", "duration_minutes", "category", "description"],
        additionalProperties: false,
      },
    },
    // 1-based numbers of screenshots that had no readable service menu.
    unreadable: { type: "array", items: { type: "integer" } },
  },
  required: ["services", "unreadable"],
  additionalProperties: false,
};

const text = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// "$85" → "85", "from $220.00" → "220", "$42.50" → "42.50", "Free" → "0",
// anything else → "" (the pro fills it in).
function priceText(raw) {
  const s = String(raw ?? "").trim();
  if (/^free$/i.test(s) || /^\$?0+(\.0+)?$/.test(s)) return "0";
  const m = s.replace(/,/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!m) return "";
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

function minutesText(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= MIN_MINUTES && n <= MAX_MINUTES ? String(n) : "";
}

let seq = 0;
const newKey = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;

// Claude's result → editable rows (strings, as the review table shows them).
export function cleanExtracted(extracted) {
  return (extracted?.services || [])
    .map((s) => ({
      key: newKey(),
      name: text(s?.name, 80),
      price: priceText(s?.price),
      duration: minutesText(s?.duration_minutes),
      category: text(s?.category, 60),
      description: text(s?.description, 300),
    }))
    .filter((r) => r.name)
    .slice(0, IMPORT_MAX_ROWS);
}

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function sameService(a, b) {
  return norm(a) !== "" && norm(a) === norm(b);
}

// Each row's flags: no_time, no_price, on_page (already one of their
// services), twice (an earlier row has the same name).
export function flagRows(rows, existingNames = []) {
  const existing = new Set(existingNames.map(norm));
  const seen = new Set();
  return rows.map((r) => {
    const flags = [];
    if (!r.duration) flags.push("no_time");
    if (r.price === "") flags.push("no_price");
    const n = norm(r.name);
    if (n && existing.has(n)) flags.push("on_page");
    else if (n && seen.has(n)) flags.push("twice");
    if (n) seen.add(n);
    return { ...r, flags };
  });
}

// The rows the pro approved → services to add, or the problems to fix first.
export function validateRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  if (!list.length) return { services: [], errors: [{ key: null, message: "Add at least one service." }] };
  if (list.length > IMPORT_MAX_ROWS) return { services: [], errors: [{ key: null, message: `You can add up to ${IMPORT_MAX_ROWS} services at once.` }] };
  const services = [];
  const errors = [];
  for (const r of list) {
    const name = text(r?.name, 80);
    const priceRaw = String(r?.price ?? "").trim().replace(/^\$/, "");
    const price = Number(priceRaw);
    const minutes = Number(String(r?.duration ?? "").trim());
    const label = name || "A service";
    if (!name) errors.push({ key: r?.key ?? null, message: "A service is missing its name." });
    else if (priceRaw === "" || !Number.isFinite(price) || price < 0 || Math.round(price * 100) > MAX_PRICE_CENTS)
      errors.push({ key: r?.key ?? null, message: `${label}: add a price (0 for free).` });
    else if (!Number.isInteger(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES)
      errors.push({ key: r?.key ?? null, message: `${label}: add a time (how long it takes, ${MIN_MINUTES}–${MAX_MINUTES} minutes).` });
    else services.push({ name, price_cents: Math.round(price * 100), duration_minutes: minutes, description: cleanDescription(r?.description) });
  }
  return errors.length ? { services: [], errors } : { services, errors };
}

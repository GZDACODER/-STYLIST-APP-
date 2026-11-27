// Services import from screenshots (lib/serviceImport.js): cleaning what Claude
// read, flagging gaps and duplicates, and checking rows before they're added.
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  IMPORT_MAX_SCREENSHOTS,
  EXTRACT_SCHEMA,
  cleanExtracted,
  flagRows,
  validateRows,
  sameService,
} from "../lib/serviceImport.js";

test("up to 10 screenshots", () => {
  assert.equal(IMPORT_MAX_SCREENSHOTS, 10);
});

test("the schema Claude fills: every service has name, price, duration, category, description; strict", () => {
  const item = EXTRACT_SCHEMA.properties.services.items;
  assert.deepEqual(item.required.sort(), ["category", "description", "duration_minutes", "name", "price"].sort());
  assert.equal(item.additionalProperties, false);
  assert.equal(EXTRACT_SCHEMA.additionalProperties, false);
  assert.ok(EXTRACT_SCHEMA.properties.unreadable);
});

test("clean: trims, turns prices into dollars, keeps a missing duration blank", () => {
  const rows = cleanExtracted({
    services: [
      { name: "  Silk Press ", price: "$85", duration_minutes: 90, category: "Styling", description: " Wash and press. " },
      { name: "Knotless Braids", price: "from $220.00", duration_minutes: null, category: "", description: "" },
      { name: "Consult", price: "Free", duration_minutes: 15, category: "", description: "" },
      { name: "", price: "$10", duration_minutes: 10, category: "", description: "" },
    ],
  });
  assert.equal(rows.length, 3);
  assert.deepEqual(
    rows.map((r) => [r.name, r.price, r.duration, r.category, r.description]),
    [
      ["Silk Press", "85", "90", "Styling", "Wash and press."],
      ["Knotless Braids", "220", "", "", ""],
      ["Consult", "0", "15", "", ""],
    ]
  );
  assert.ok(rows.every((r) => typeof r.key === "string" && r.key));
});

test("clean: odd durations are dropped to blank, not guessed", () => {
  const [r] = cleanExtracted({ services: [{ name: "X", price: "$5", duration_minutes: 0, category: "", description: "" }] });
  assert.equal(r.duration, "");
  const [s] = cleanExtracted({ services: [{ name: "Y", price: "$5", duration_minutes: 5000, category: "", description: "" }] });
  assert.equal(s.duration, "");
});

test("clean: a price it can't read stays blank", () => {
  const [r] = cleanExtracted({ services: [{ name: "Color", price: "varies", duration_minutes: 60, category: "", description: "" }] });
  assert.equal(r.price, "");
});

test("same service: ignores case, spaces, punctuation and & vs and", () => {
  assert.equal(sameService("Wash & Set", "wash and set"), true);
  assert.equal(sameService("Silk-Press", "silk press"), true);
  assert.equal(sameService("Silk press", "Silk press + trim"), false);
});

test("flags: no time, no price, already on your page, listed twice", () => {
  const rows = cleanExtracted({
    services: [
      { name: "Silk Press", price: "$85", duration_minutes: null, category: "", description: "" },
      { name: "Trim", price: "", duration_minutes: 30, category: "", description: "" },
      { name: "Color", price: "$120", duration_minutes: 120, category: "", description: "" },
      { name: "color", price: "$120", duration_minutes: 120, category: "", description: "" },
    ],
  });
  const flagged = flagRows(rows, ["Silk press"]);
  assert.deepEqual(flagged[0].flags, ["no_time", "on_page"]);
  assert.deepEqual(flagged[1].flags, ["no_price"]);
  assert.deepEqual(flagged[2].flags, []);
  assert.deepEqual(flagged[3].flags, ["twice"]);
});

test("validate: ready rows become services in cents and minutes", () => {
  const { services, errors } = validateRows([
    { key: "a", name: "Silk Press", price: "85", duration: "90", category: "Styling", description: "x" },
    { key: "b", name: "Consult", price: "0", duration: "15", category: "", description: "" },
    { key: "c", name: "Trim", price: "42.50", duration: "45", category: "", description: "" },
  ]);
  assert.deepEqual(errors, []);
  assert.deepEqual(services, [
    { name: "Silk Press", price_cents: 8500, duration_minutes: 90, description: "x" },
    { name: "Consult", price_cents: 0, duration_minutes: 15, description: "" },
    { name: "Trim", price_cents: 4250, duration_minutes: 45, description: "" },
  ]);
});

test("validate: every row needs a name, a price and a time; says which row", () => {
  const { services, errors } = validateRows([
    { key: "a", name: "", price: "10", duration: "30" },
    { key: "b", name: "Color", price: "", duration: "30" },
    { key: "c", name: "Braids", price: "200", duration: "" },
    { key: "d", name: "Too long", price: "10", duration: "5000" },
  ]);
  assert.equal(services.length, 0);
  assert.deepEqual(
    errors.map((e) => e.key),
    ["a", "b", "c", "d"]
  );
  assert.match(errors[2].message, /time/i);
});

test("validate: nothing to add, or too many", () => {
  assert.match(validateRows([]).errors[0].message, /at least one/i);
  const many = Array.from({ length: 101 }, (_, i) => ({ key: String(i), name: `S${i}`, price: "1", duration: "30" }));
  assert.match(validateRows(many).errors[0].message, /100/);
});

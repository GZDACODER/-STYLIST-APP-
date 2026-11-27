// Service descriptions: example services and imports bring theirs along. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { exampleServiceRows } from "../lib/exampleServiceRows.js";
import { validateRows } from "../lib/serviceImport.js";
import { cleanDescription } from "../lib/serviceDescription.js";

test("example services keep their description; every row has one (bulk insert needs matching keys)", () => {
  const rows = exampleServiceRows(
    [
      { name: "Silk Press", price_cents: 8500, duration_minutes: 90, description: "Wash, deep condition, blow-dry and press." },
      { name: "Trim", price_cents: 3500, duration_minutes: 30 },
    ],
    "u1"
  );
  assert.equal(rows[0].description, "Wash, deep condition, blow-dry and press.");
  assert.equal(rows[1].description, "");
  assert.deepEqual(Object.keys(rows[0]).sort(), Object.keys(rows[1]).sort());
});

test("imported services keep their description", () => {
  const { services, errors } = validateRows([
    { key: "a", name: "Gloss", price: "65", duration: "45", description: "  Shine and tone between color visits. " },
    { key: "b", name: "Trim", price: "35", duration: "30" },
  ]);
  assert.deepEqual(errors, []);
  assert.equal(services[0].description, "Shine and tone between color visits.");
  assert.equal(services[1].description, "");
});

test("a description is one tidy line of at most 300 characters", () => {
  assert.equal(cleanDescription("  Wash,\n deep   condition. "), "Wash, deep condition.");
  assert.equal(cleanDescription("x".repeat(400)).length, 300);
  assert.equal(cleanDescription(null), "");
});

// Fixes from the launch-readiness run (docs/LAUNCH_READINESS.md). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickMoves } from "../lib/homeFill.js";
import { setupSteps } from "../lib/setupSteps.js";
import { madeByPro } from "../lib/bookedBy.js";
import { servicePrice } from "../lib/servicePrice.js";
import { DEFAULT_DEPOSIT_POLICY, policyOrDefault } from "../lib/depositPolicy.js";

const base = { owed: [], overdue: [], nextWeekOpenMin: 600, thisWeekOfferedMin: 600, thisWeekOpenMinLeft: 300, hasServices: true, hasOpeningsAhead: true };

test("no share move while the booking page can't take a booking", () => {
  for (const missing of [{ hasServices: false }, { hasOpeningsAhead: false }]) {
    const kinds = pickMoves({ ...base, ...missing }).map((m) => m.kind);
    assert.equal(kinds.includes("share"), false, JSON.stringify(missing));
  }
});

test("setup: opening times is a step, and services + hours alone aren't bookable", () => {
  const s = setupSteps({ services: 1, hours: 5, openingsAhead: 0, stripe: false, cover: false, booked: false });
  assert.ok(s.steps.some((x) => x.key === "openings" && !x.done && x.href === "/dashboard/openings"));
  assert.equal(s.bookable, false);
});

test("setup: bookable once there's a service and an opening ahead", () => {
  const s = setupSteps({ services: 1, hours: 0, openingsAhead: 2, stripe: false, cover: false, booked: false });
  assert.equal(s.bookable, true);
});

test("setup: the steps a booking needs come first, share after them", () => {
  const keys = setupSteps({ services: 0, hours: 0, openingsAhead: 0 }).steps.map((x) => x.key);
  assert.deepEqual(keys.slice(0, 4), ["services", "hours", "openings", "share"]);
  const s = setupSteps({ services: 1, hours: 1, openingsAhead: 1, stripe: true, cover: true, booked: true });
  assert.equal(s.left, 0);
});

test("new-booking email: only bookings the pro made themselves are skipped", () => {
  assert.equal(madeByPro({ booked_by: "pro-1", stylist_id: "pro-1" }), true);
  assert.equal(madeByPro({ booked_by: "client-9", stylist_id: "pro-1" }), false);
  assert.equal(madeByPro({ booked_by: null, stylist_id: "pro-1" }), false);
});

test("free services say Free, priced ones keep cents", () => {
  assert.equal(servicePrice(0), "Free");
  assert.equal(servicePrice(null), "Free");
  assert.equal(servicePrice(3500), "$35.00");
});

test("deposit policy falls back to a plain default when the pro wrote none", () => {
  assert.equal(policyOrDefault(""), DEFAULT_DEPOSIT_POLICY);
  assert.equal(policyOrDefault("   "), DEFAULT_DEPOSIT_POLICY);
  assert.equal(policyOrDefault("No refunds."), "No refunds.");
  assert.match(DEFAULT_DEPOSIT_POLICY, /24 hours/);
});

import { exampleServiceRows } from "../lib/exampleServiceRows.js";
test("example services insert as rows with the same columns (PostgREST bulk insert needs matching keys; aftercare is NOT NULL)", () => {
  const rows = exampleServiceRows(
    [
      { name: "Silk Press", price_cents: 8500, duration_minutes: 90, aftercare: "Wrap it." },
      { name: "Consultation", price_cents: 0, duration_minutes: 30 },
    ],
    "pro-1"
  );
  assert.deepEqual(Object.keys(rows[0]).sort(), Object.keys(rows[1]).sort());
  assert.deepEqual(rows[1], { stylist_id: "pro-1", name: "Consultation", price_cents: 0, duration_minutes: 30, aftercare: "" });
});

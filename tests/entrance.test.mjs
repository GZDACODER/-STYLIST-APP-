// Home's once-a-day entrance: one decision per page load, shared by every
// card that asks (app/(studio)/dashboard/home/entrance.js). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { decideEntrance } from "../app/(studio)/dashboard/home/entrance.js";

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) };
};

test("first ask of the day plays, and every other card on the page gets the same answer", () => {
  const storage = memory();
  assert.equal(decideEntrance("2026-11-26", { storage, reduced: false }), "play");
  assert.equal(decideEntrance("2026-11-26", { storage, reduced: false }), "play");
});

test("a later page load the same day is static", () => {
  const storage = memory();
  storage.setItem("home-anim:2026-11-27", "1");
  assert.equal(decideEntrance("2026-11-27", { storage, reduced: false }), "static");
});

test("reduced motion is always static", () => {
  assert.equal(decideEntrance("2026-11-28", { storage: memory(), reduced: true }), "static");
});

test("blocked storage is static", () => {
  const storage = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
  assert.equal(decideEntrance("2026-11-29", { storage, reduced: false }), "static");
});

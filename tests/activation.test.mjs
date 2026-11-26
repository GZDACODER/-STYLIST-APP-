// Launch-week dashboard: where each new pro is, and the note to send them (lib/activation.js). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { activation, nudge, looksLikeTest, STAGES } from "../lib/activation.js";

const NOW = Date.parse("2026-11-26T18:00:00Z");
const day = (n) => new Date(NOW - n * 86400000).toISOString();
const pro = (x = {}) => ({
  email: "sam@studio.com", firstName: "Sam", businessName: "Studio Sam", slug: "studio-sam", trade: "barber",
  createdAt: day(4), servicesAt: null, services: 0, openingsAhead: 0, openingsAt: null, clientBookings: 0, firstBookingAt: null, lastSignInAt: day(1),
  ...x,
});

test("stages in order: signed up, services, open times, first booking", () => {
  assert.deepEqual(STAGES.map((s) => s.key), ["signed_up", "services", "bookable", "booked"]);
  assert.equal(activation(pro(), NOW).stage, "signed_up");
  assert.equal(activation(pro({ services: 2, servicesAt: day(3) }), NOW).stage, "services");
  assert.equal(activation(pro({ services: 2, servicesAt: day(3), openingsAhead: 4, openingsAt: day(2) }), NOW).stage, "bookable");
  assert.equal(activation(pro({ services: 2, openingsAhead: 0, clientBookings: 1, firstBookingAt: day(1) }), NOW).stage, "booked");
});

test("days stuck counts from when they reached the step", () => {
  assert.equal(activation(pro(), NOW).daysStuck, 4);
  assert.equal(activation(pro({ services: 1, servicesAt: day(3) }), NOW).daysStuck, 3);
  assert.equal(activation(pro({ services: 1, servicesAt: day(3), openingsAhead: 1, openingsAt: day(2) }), NOW).daysStuck, 2);
});

test("stuck: 2+ days on a setup step; a booked pro is never stuck", () => {
  assert.equal(activation(pro({ createdAt: day(1) }), NOW).stuck, false);
  assert.equal(activation(pro({ createdAt: day(2) }), NOW).stuck, true);
  assert.equal(activation(pro({ clientBookings: 3, firstBookingAt: day(9) }), NOW).stuck, false);
});

test("the note names their business and the one next step, from the owner", () => {
  const n = nudge(pro(), "signed_up", "https://www.clientelesuite.com");
  assert.match(n.subject, /Studio Sam/);
  assert.match(n.body, /^Hi Sam,/);
  assert.match(n.body, /services/i);
  assert.match(n.body, /https:\/\/www\.clientelesuite\.com\/dashboard\/services/);
  assert.match(nudge(pro(), "services", "https://x.com").body, /\/dashboard\/openings/);
  assert.match(nudge(pro(), "bookable", "https://x.com").body, /https:\/\/x\.com\/book\/studio-sam/);
  assert.match(nudge(pro(), "booked", "https://x.com").subject, /going/i);
});

test("trade words: a tutor hears about students, not clients", () => {
  assert.match(nudge(pro({ trade: "tutor" }), "bookable", "https://x.com").body, /students/);
  assert.doesNotMatch(nudge(pro({ trade: "tutor" }), "bookable", "https://x.com").body, /clients/);
});

test("no first name: a plain hello", () => {
  assert.match(nudge(pro({ firstName: "" }), "signed_up", "https://x.com").body, /^Hi,/);
});

test("test accounts are spotted (plus addresses, our own domain, demo, Test in the name)", () => {
  assert.equal(looksLikeTest(pro({ email: "me+barber@gmail.com" })), true);
  assert.equal(looksLikeTest(pro({ email: "demo-tutor@clientelesuite.com" })), true);
  assert.equal(looksLikeTest(pro({ businessName: "Ink Test Studio" })), true);
  assert.equal(looksLikeTest(pro({ businessName: "Launch Check Studio" })), true);
  assert.equal(looksLikeTest(pro()), false);
});

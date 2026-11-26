// The landing page's playable sample studio (lib/landingDemo.js). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { sampleStudio, applyMove, demoView, DEMO_NAMES } from "../lib/landingDemo.js";

const words = { client: "client", clients: "clients", appointment: "appointment", appointments: "appointments" };
const trade = (key, services, w = words) => ({ key, words: w, services: services.map(([name, priceCents, minutes]) => ({ name, priceCents, minutes })) });
const stylist = trade("stylist", [["Silk Press", 8500, 90], ["Trim & Style", 5500, 45], ["Consultation", 0, 30]]);
const tutor = trade("tutor", [["Math", 6000, 60], ["Free Assessment", 0, 30]], { client: "student", clients: "students", appointment: "session", appointments: "sessions" });
const DAYS = /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/;

test("starting week is about 64% booked", () => {
  const v = demoView(sampleStudio(stylist));
  assert.ok(v.week.pct >= 60 && v.week.pct <= 68, `pct ${v.week.pct}`);
  assert.equal(v.week.days[2].isToday, true);
  assert.equal(v.week.days[6].hasOpenings, false);
});

test("starting month is ahead of last month", () => {
  const { month } = demoView(sampleStudio(stylist));
  assert.ok(month.total >= 200000 && month.total <= 230000, `total ${month.total}`);
  assert.ok(month.changePct >= 8 && month.changePct <= 16, `change ${month.changePct}`);
});

test("share fills the week", () => {
  const s = sampleStudio(stylist);
  const before = demoView(s).month.total;
  const { state } = applyMove(s, "share");
  const v = demoView(state);
  assert.equal(v.week.pct, 100);
  assert.ok(v.month.total > before);
  assert.match(state.done.share, /\(sample\)/);
});

test("remind adds the owed amount to this month", () => {
  const s = sampleStudio(stylist);
  const before = demoView(s).month.total;
  const { state, announce } = applyMove(s, "remind");
  assert.equal(demoView(state).month.total, before + s.owed.cents);
  assert.match(announce, new RegExp(`${DEMO_NAMES.stylist.owed} paid \\$85 \\(sample\\)`));
});

test("invite books the first open slot", () => {
  const s = sampleStudio(stylist);
  const before = demoView(s).week.bookedCount;
  const { state, announce } = applyMove(s, "invite");
  assert.equal(demoView(state).week.bookedCount, before + 1);
  assert.match(announce, new RegExp(DEMO_NAMES.stylist.overdue));
  assert.match(announce, DAYS);
});

test("invite after share books next week", () => {
  const full = applyMove(sampleStudio(stylist), "share").state;
  const before = demoView(full);
  const { state, announce } = applyMove(full, "invite");
  const after = demoView(state);
  assert.equal(after.week.pct, 100);
  assert.ok(after.month.total > before.month.total);
  assert.match(announce, /next week/);
});

test("double tap does nothing", () => {
  const s = sampleStudio(stylist);
  const once = applyMove(s, "remind");
  const twice = applyMove(once.state, "remind");
  assert.equal(demoView(twice.state).month.total, demoView(once.state).month.total);
  assert.equal(twice.announce, "");
  assert.equal(twice.state, once.state);
});

test("play again is the same start", () => {
  const a = demoView(sampleStudio(stylist));
  applyMove(sampleStudio(stylist), "share");
  const b = demoView(sampleStudio(stylist));
  assert.equal(b.week.pct, a.week.pct);
  assert.equal(b.month.total, a.month.total);
});

test("tutor sample uses tutor services and words only", () => {
  const s = sampleStudio(tutor);
  const all = applyMove(applyMove(s, "share").state, "invite").state;
  assert.equal(all.bookings.some((b) => /Silk/.test(b.service)), false);
  assert.notEqual(s.owed.service, "Free Assessment");
  assert.ok(s.owed.cents > 0);
  assert.equal(s.owed.name, DEMO_NAMES.tutor.owed);
});

test("share only counts today's new visits as earned (later days are booked, not earned)", () => {
  const s = sampleStudio(stylist);
  const before = demoView(s).month.total;
  const { state } = applyMove(s, "share");
  const added = state.bookings.slice(s.bookings.length);
  const today = added.filter((b) => b.booking_date === "2026-11-18").reduce((a, b) => a + b.priceCents, 0);
  assert.ok(added.some((b) => b.booking_date > "2026-11-18"), "later days get booked too");
  assert.equal(demoView(state).month.total, before + today);
});

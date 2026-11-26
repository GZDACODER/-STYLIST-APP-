// Home "Fill your book" calculations (lib/homeFill.js). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { weekFill, monthCurve, pickMoves } from "../lib/homeFill.js";

const week = { start: "2026-11-23", end: "2026-11-29" }; // Mon..Sun
const op = (date, from, to) => ({ opening_date: date, start_time: `${from}:00`, end_time: `${to}:00` });
const bk = (date, from, to, status = "confirmed") => ({ booking_date: date, start_time: `${from}:00`, end_time: `${to}:00`, status });

test("weekFill: basic fill", () => {
  const w = weekFill({
    week,
    today: "2026-11-26",
    nowTime: "12:00",
    openings: [op("2026-11-23", "09:00", "17:00"), op("2026-11-26", "09:00", "13:00")],
    bookings: [bk("2026-11-23", "10:00", "11:00"), bk("2026-11-23", "13:00", "15:00"), bk("2026-11-26", "09:00", "10:00")],
  });
  assert.equal(w.pct, 33); // 60 + 120 + 60 = 240 of 480 + 240 = 720
  assert.equal(w.bookedCount, 3);
  assert.equal(w.days.length, 7);
  assert.equal(w.days[0].label, "Mon");
  assert.equal(w.days[0].pct, 38);
  assert.equal(w.days[3].isToday, true);
  assert.equal(w.days[0].past, true);
  assert.equal(w.days[5].hasOpenings, false);
});

test("weekFill: openings but no bookings", () => {
  const w = weekFill({ week, today: "2026-11-23", nowTime: "08:00", openings: [op("2026-11-23", "09:00", "17:00")], bookings: [] });
  assert.equal(w.pct, 0);
  assert.equal(w.days[0].hasOpenings, true);
  assert.ok(w.openMinLeft > 0);
});

test("weekFill: booking with no opening that day", () => {
  const w = weekFill({
    week,
    today: "2026-11-23",
    nowTime: "08:00",
    openings: [op("2026-11-23", "09:00", "10:00")],
    bookings: [bk("2026-11-25", "10:00", "11:00")],
  });
  assert.equal(w.days[2].pct, 100);
  assert.ok(w.pct <= 100);
});

test("weekFill: pending_payment ignored", () => {
  const w = weekFill({
    week,
    today: "2026-11-23",
    nowTime: "08:00",
    openings: [op("2026-11-24", "09:00", "17:00")],
    bookings: [bk("2026-11-24", "10:00", "11:00", "pending_payment")],
  });
  assert.equal(w.bookedMin, 0);
  assert.equal(w.bookedCount, 0);
});

test("weekFill: open time left counts only what's still to come", () => {
  // Today Mon at 12:00: the 09:00–17:00 opening has 300 min left, minus the
  // 13:00–14:00 booking = 240; Tue 09:00–10:00 adds 60.
  const w = weekFill({
    week,
    today: "2026-11-23",
    nowTime: "12:00",
    openings: [op("2026-11-23", "09:00", "17:00"), op("2026-11-24", "09:00", "10:00")],
    bookings: [bk("2026-11-23", "13:00", "14:00")],
  });
  assert.equal(w.openMinLeft, 300);
});

const days = (n, values = {}) => Array.from({ length: n }, (_, i) => ({ day: i + 1, cents: values[i + 1] || 0 }));

test("monthCurve: ahead", () => {
  const m = monthCurve({ thisDays: days(30, { 1: 1000, 2: 2000 }), lastDays: days(30, { 1: 1000, 2: 1000, 30: 5000 }), todayDay: 3 });
  assert.equal(m.total, 3000);
  assert.equal(m.points.length, 3);
  assert.equal(m.points.at(-1).cum, 3000);
  assert.equal(m.lastSameDays, 2000);
  assert.equal(m.lastTotal, 7000);
  assert.equal(m.changePct, 50);
  assert.equal(m.ahead, true);
  assert.equal(m.passedLastMonth, false);
});

test("monthCurve: last month empty", () => {
  const m = monthCurve({ thisDays: days(30, { 1: 1000 }), lastDays: days(31), todayDay: 5 });
  assert.equal(m.changePct, null);
  assert.equal(m.total, 1000);
});

test("monthCurve: both empty", () => {
  const m = monthCurve({ thisDays: days(30), lastDays: days(31), todayDay: 10 });
  assert.equal(m.total, 0);
  assert.ok(m.points.every((p) => p.cum === 0));
});

test("monthCurve: clamps to a shorter last month", () => {
  const m = monthCurve({ thisDays: days(31, { 30: 100 }), lastDays: days(28, { 28: 900 }), todayDay: 30 });
  assert.equal(m.lastSameDays, m.lastTotal);
  assert.equal(m.lastTotal, 900);
});

const owedRow = { bookingId: "b1", clientName: "Jordan", serviceName: "Braids", owedCents: 15000, hasEmail: true };
const od = (n, extra = {}) => ({ clientId: `c${n}`, bookingId: `b${n}`, serviceId: `s${n}`, name: `Client ${n}`, usualWeeks: 4, sinceWeeks: 7, hasEmail: true, invitedRecently: false, ...extra });
const base = { owed: [], overdue: [], nextWeekOpenTimes: 10, thisWeekOpenMinLeft: 300, hasServices: true, hasOpeningsAhead: true };

test("pickMoves: priority and cap", () => {
  const moves = pickMoves({ ...base, owed: [owedRow], overdue: [od(1), od(2)], nextWeekOpenTimes: 0 });
  assert.deepEqual(moves.map((m) => m.kind), ["owed", "overdue", "thin"]);
  assert.equal(moves[1].more, 1);
  assert.equal(moves[0].canEmail, true);
});

test("pickMoves: owed without email, overdue without email or recently invited skipped", () => {
  const moves = pickMoves({ ...base, owed: [{ ...owedRow, hasEmail: false }], overdue: [od(1, { hasEmail: false }), od(2, { invitedRecently: true })] });
  assert.equal(moves[0].kind, "owed");
  assert.equal(moves[0].canEmail, false);
  assert.equal(moves.some((m) => m.kind === "overdue"), false);
});

test("pickMoves: largest balance owed first", () => {
  const moves = pickMoves({ ...base, owed: [owedRow, { ...owedRow, bookingId: "b9", owedCents: 40000 }] });
  assert.equal(moves[0].bookingId, "b9");
});

test("pickMoves: setup", () => {
  const moves = pickMoves({ ...base, owed: [owedRow], overdue: [od(1)], hasServices: false });
  assert.equal(moves[0].kind, "setup-services");
  assert.equal(moves.some((m) => m.kind === "owed" || m.kind === "overdue"), false);
});

test("pickMoves: share fallback", () => {
  const moves = pickMoves(base);
  assert.deepEqual(moves.map((m) => m.kind), ["share"]);
  assert.equal(moves[0].thisWeekOpenMinLeft, 300);
});

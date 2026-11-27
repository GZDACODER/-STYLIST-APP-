// Email all pros (lib/announce.js) and the Clientele money page (lib/adminMoney.js). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { AUDIENCES, audienceOf, announceFooter } from "../lib/announce.js";
import { moneySummary } from "../lib/adminMoney.js";

const pro = (x) => ({ id: x.id || "a", email: "a@x.com", test: false, founding: false, step: 2, status: { key: "trial" }, notify: {}, ...x });

test("audiences: everyone, on trial, founding, paying, free, not set up yet", () => {
  assert.deepEqual(AUDIENCES.map((a) => a.key), ["all", "trial", "founding", "paying", "free", "setup"]);
});

test("never test or demo accounts, never paused ones, never people who turned Clientele news off, never without email", () => {
  const list = [
    pro({ id: "1" }),
    pro({ id: "2", test: true }),
    pro({ id: "3", notify: { news: false } }),
    pro({ id: "4", email: "" }),
    pro({ id: "5", paused: true }),
  ];
  assert.deepEqual(audienceOf(list, "all").map((p) => p.id), ["1"]);
});

test("each audience picks the right pros", () => {
  const list = [
    pro({ id: "t", status: { key: "trial" } }),
    pro({ id: "f", founding: true, status: { key: "trial" } }),
    pro({ id: "p", status: { key: "paying" } }),
    pro({ id: "c", status: { key: "free" } }),
    pro({ id: "s", step: 0, status: { key: "trial" } }),
  ];
  assert.deepEqual(audienceOf(list, "paying").map((p) => p.id), ["p"]);
  assert.deepEqual(audienceOf(list, "founding").map((p) => p.id), ["f"]);
  assert.deepEqual(audienceOf(list, "free").map((p) => p.id), ["c"]);
  assert.deepEqual(audienceOf(list, "setup").map((p) => p.id), ["s"]);
  assert.deepEqual(audienceOf(list, "trial").map((p) => p.id).sort(), ["f", "s", "t"]);
});

test("the footer says how to stop these emails", () => {
  assert.match(announceFooter("https://x.com"), /Settings → Notifications/);
  assert.match(announceFooter("https://x.com"), /https:\/\/x\.com\/dashboard\/settings\/notifications/);
});

const NOW = Date.parse("2026-11-27T18:00:00Z");
const ts = (iso) => Math.floor(Date.parse(iso) / 1000);

test("money: balance, deposit fees this month and last, subscription income, MRR, payouts on the way", () => {
  const s = moneySummary(
    {
      balance: { available: [{ amount: 1200, currency: "usd" }], pending: [{ amount: 60, currency: "usd" }] },
      fees: [
        { amount: 60, amount_refunded: 0, created: ts("2026-11-20T00:00:00Z") },
        { amount: 90, amount_refunded: 30, created: ts("2026-11-02T00:00:00Z") },
        { amount: 45, amount_refunded: 0, created: ts("2026-10-15T00:00:00Z") },
      ],
      invoices: [
        { amount_paid: 2500, created: ts("2026-11-10T00:00:00Z") },
        { amount_paid: 25000, created: ts("2026-10-01T00:00:00Z") },
      ],
      subscriptions: [
        { status: "active", items: { data: [{ price: { unit_amount: 2500, recurring: { interval: "month" } }, quantity: 1 }] } },
        { status: "active", items: { data: [{ price: { unit_amount: 25000, recurring: { interval: "year" } }, quantity: 1 }] } },
        { status: "trialing", items: { data: [{ price: { unit_amount: 2500, recurring: { interval: "month" } }, quantity: 1 }] } },
      ],
      payouts: [
        { amount: 500, status: "in_transit", arrival_date: ts("2026-11-29T00:00:00Z") },
        { amount: 300, status: "paid", arrival_date: ts("2026-11-25T00:00:00Z") },
      ],
    },
    NOW
  );
  assert.equal(s.availableCents, 1200);
  assert.equal(s.pendingCents, 60);
  assert.equal(s.feesThisMonthCents, 120);
  assert.equal(s.feesLastMonthCents, 45);
  assert.equal(s.subsThisMonthCents, 2500);
  assert.equal(s.mrrCents, 2500 + Math.round(25000 / 12));
  assert.equal(s.payingCount, 2);
  assert.equal(s.onTheWayCents, 500);
  assert.equal(s.thisMonthCents, 120 + 2500);
});

test("money: empty Stripe account is all zeros", () => {
  const s = moneySummary({}, NOW);
  assert.equal(s.availableCents, 0);
  assert.equal(s.mrrCents, 0);
  assert.equal(s.onTheWayCents, 0);
});

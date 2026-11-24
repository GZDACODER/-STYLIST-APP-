// The Money tab's numbers (step 62 SQL). Plain functions, no database calls.
// Same rules as Reports: a visit's price counts once it went ahead
// (confirmed, started, not a no-show or "someone else came"). Tips, product
// sales and other income are what the pro records; a balance paid later
// isn't new income (the visit already counted), it just clears what's owed.
import { addDays, daysBetween } from "@/lib/reports";

export const VIEWS = [
  ["day", "Day"],
  ["week", "Week"],
  ["month", "Month"],
  ["year", "Year"],
];
export const KINDS = [
  ["tip", "Tip"],
  ["product", "Product sale"],
  ["balance", "Balance paid"],
  ["other", "Other income"],
];
export const METHODS = [
  ["cash", "Cash"],
  ["zelle", "Zelle"],
  ["cashapp", "Cash App"],
  ["venmo", "Venmo"],
  ["card", "Card (other reader)"],
  ["check", "Check"],
  ["other", "Other"],
];
export const KIND_LABEL = Object.fromEntries(KINDS);
export const METHOD_LABEL = Object.fromEntries(METHODS);

const pad = (n) => String(n).padStart(2, "0");
const parts = (t) => t.split("-").map(Number);
const ymd = (y, m, d) => {
  const x = new Date(Date.UTC(y, m - 1, d));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
};
const weekday = (t) => new Date(`${t}T12:00:00Z`).getUTCDay();
const fmt = (t, opts) => new Date(`${t}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });

/**
 * { view, from, to, label, prev, next, buckets: [{ from, to, label }] } for
 * the day/week/month/year containing `anchor` ("YYYY-MM-DD").
 */
export function moneyPeriod(view, anchor) {
  const [y, m, d] = parts(anchor);
  if (view === "day") {
    return { view, from: anchor, to: anchor, label: fmt(anchor, { weekday: "long", month: "long", day: "numeric", year: "numeric" }), prev: addDays(anchor, -1), next: addDays(anchor, 1), buckets: [] };
  }
  if (view === "week") {
    const from = addDays(anchor, -((weekday(anchor) + 6) % 7)); // Monday
    const to = addDays(from, 6);
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const day = addDays(from, i);
      return { from: day, to: day, label: fmt(day, { weekday: "short" }) };
    });
    return { view, from, to, label: `${fmt(from, { month: "short", day: "numeric" })} – ${fmt(to, { month: "short", day: "numeric", year: "numeric" })}`, prev: addDays(from, -7), next: addDays(from, 7), buckets };
  }
  if (view === "year") {
    const buckets = Array.from({ length: 12 }, (_, i) => ({ from: ymd(y, i + 1, 1), to: ymd(y, i + 2, 0), label: fmt(ymd(y, i + 1, 1), { month: "narrow" }) }));
    return { view, from: ymd(y, 1, 1), to: ymd(y, 12, 31), label: String(y), prev: ymd(y - 1, 1, 1), next: ymd(y + 1, 1, 1), buckets };
  }
  const from = ymd(y, m, 1);
  const to = ymd(y, m + 1, 0);
  const days = daysBetween(from, to) + 1;
  const buckets = Array.from({ length: days }, (_, i) => {
    const day = addDays(from, i);
    return { from: day, to: day, label: String(i + 1) };
  });
  return { view: "month", from, to, label: fmt(from, { month: "long", year: "numeric" }), prev: ymd(y, m - 1, 1), next: ymd(y, m + 1, 1), buckets, d };
}

const wentAhead = (b, now) =>
  b.status === "confirmed" &&
  `${b.booking_date}T${String(b.start_time).slice(0, 5)}` <= now &&
  b.outcome !== "no_show" &&
  b.outcome !== "replaced";

// What's still owed on a visit marked "owes a balance", less balances paid.
export function owedOn(b, paidByBooking) {
  if (b.status !== "confirmed" || b.outcome !== "completed_owed") return 0;
  const owed = b.owed_cents != null ? b.owed_cents : Math.max(0, (b.price_cents || 0) - (b.deposit_status === "paid" ? b.deposit_cents || 0 : 0));
  return Math.max(0, owed - (paidByBooking.get(b.id) || 0));
}

/**
 * bookings: rows with booking_date, start_time, status, outcome, price_cents,
 *   deposit_cents, deposit_status, deposit_paid_at (local day or null)
 * payments: rows with kind, method, amount_cents, paid_on
 * now: local "YYYY-MM-DDTHH:MM"
 */
export function earnings({ bookings, payments, period, now }) {
  const inRange = (t) => t >= period.from && t <= period.to;
  const out = { servicesCents: 0, visits: 0, tipsCents: 0, productCents: 0, otherCents: 0, balancesCents: 0, depositsCents: 0, depositCount: 0, totalCents: 0, byMethod: {}, series: period.buckets.map((b) => ({ ...b, cents: 0 })) };
  const bucketFor = (t) => out.series.find((s) => t >= s.from && t <= s.to);
  for (const b of bookings) {
    if (b.deposit_paid_at && inRange(b.deposit_paid_at) && b.deposit_cents > 0 && ["paid", "refund_pending", "refunded"].includes(b.deposit_status)) {
      if (b.deposit_status === "paid") {
        out.depositsCents += b.deposit_cents;
        out.depositCount += 1;
      }
    }
    if (!inRange(b.booking_date) || !wentAhead(b, now)) continue;
    out.visits += 1;
    out.servicesCents += b.price_cents || 0;
    const s = bucketFor(b.booking_date);
    if (s) s.cents += b.price_cents || 0;
  }
  for (const p of payments) {
    if (!inRange(p.paid_on)) continue;
    out.byMethod[p.method] = (out.byMethod[p.method] || 0) + p.amount_cents;
    if (p.kind === "balance") {
      out.balancesCents += p.amount_cents;
      continue;
    }
    if (p.kind === "tip") out.tipsCents += p.amount_cents;
    else if (p.kind === "product") out.productCents += p.amount_cents;
    else out.otherCents += p.amount_cents;
    const s = bucketFor(p.paid_on);
    if (s) s.cents += p.amount_cents;
  }
  if (out.depositsCents) out.byMethod.stripe = out.depositsCents;
  out.totalCents = out.servicesCents + out.tipsCents + out.productCents + out.otherCents;
  return out;
}

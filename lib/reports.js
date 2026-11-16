// The numbers on the Reports tab. Plain functions (no database calls), so
// they can be tested on their own. The rules match the Monday summary email:
//   - a visit "went ahead" if it's confirmed, has started, and wasn't marked
//     no-show or "someone else came"; revenue is those visits' service prices
//   - deposits count on the day they were paid
//   - a balance owed is the amount written down, else the price less any
//     paid deposit
// "Regular" means the client is a Regular now (their client card).
import { DEPOSIT_FEE_FIXED_CENTS, DEPOSIT_FEE_PERCENT } from "@/lib/plans";

export const PERIODS = [
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_3_months", label: "Last 3 months" },
  { value: "this_year", label: "This year" },
];

const pad = (n) => String(n).padStart(2, "0");
const ymd = (y, m, d) => {
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
};
const parts = (text) => text.split("-").map(Number);
const addDays = (text, n) => {
  const [y, m, d] = parts(text);
  return ymd(y, m, d + n);
};
const daysBetween = (a, b) => {
  const [ay, am, ad] = parts(a);
  const [by, bm, bd] = parts(b);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
};

// { from, to, prevFrom, prevTo, label, buckets: "week" | "month" } for a
// period, as "YYYY-MM-DD" in the business's time zone. `to` is the last day
// of the period (it can be after today: the rest shows as booked ahead).
export function periodRange(period, today) {
  const [y, m] = parts(today);
  if (period === "last_month") {
    const from = ymd(y, m - 1, 1);
    const to = ymd(y, m, 0);
    return { from, to, prevFrom: ymd(y, m - 2, 1), prevTo: ymd(y, m - 1, 0), buckets: "week", compare: "the month before" };
  }
  if (period === "last_3_months") {
    // The two full months before this one, plus this month.
    const from = ymd(y, m - 2, 1);
    const to = ymd(y, m + 1, 0);
    return { from, to, prevFrom: ymd(y, m - 5, 1), prevTo: ymd(y, m - 2, 0), buckets: "week", compare: "the 3 months before" };
  }
  if (period === "this_year") {
    return { from: ymd(y, 1, 1), to: ymd(y, 12, 31), prevFrom: ymd(y - 1, 1, 1), prevTo: ymd(y - 1, 12, 31), buckets: "month", compare: "last year" };
  }
  return { from: ymd(y, m, 1), to: ymd(y, m + 1, 0), prevFrom: ymd(y, m - 1, 1), prevTo: ymd(y, m, 0), buckets: "week", compare: "last month" };
}

// The start of each chart bar: Mondays (weeks) or the 1st (months).
function bucketStarts(from, to, kind) {
  const starts = [];
  if (kind === "month") {
    let [y, m] = parts(from);
    while (ymd(y, m, 1) <= to) {
      starts.push(ymd(y, m, 1));
      m += 1;
    }
    return starts;
  }
  const [fy, fm, fd] = parts(from);
  const dow = new Date(Date.UTC(fy, fm - 1, fd)).getUTCDay(); // 0 = Sunday
  let start = addDays(from, -((dow + 6) % 7));
  while (start <= to) {
    starts.push(start);
    start = addDays(start, 7);
  }
  return starts;
}

function bucketOf(date, kind) {
  if (kind === "month") return `${date.slice(0, 7)}-01`;
  const [y, m, d] = parts(date);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return addDays(date, -((dow + 6) % 7));
}

export function depositFee(cents) {
  const fee = Math.round((cents * DEPOSIT_FEE_PERCENT) / 100) + DEPOSIT_FEE_FIXED_CENTS;
  return Math.max(0, Math.min(cents, fee));
}

// bookings: rows with booking_date, start_time, status, price_cents,
//   deposit_cents, deposit_status, deposit_paid_at (local "YYYY-MM-DD" or
//   null), outcome, owed_cents, client_id, reschedule_count
// regularIds: Set of client ids who are Regulars now
// clientsCreated: array of local "YYYY-MM-DD" days client cards were made
// now: local "YYYY-MM-DDTHH:MM"
export function summarize({ bookings, regularIds, clientsCreated, from, to, now }) {
  const today = now.slice(0, 10);
  const started = (b) => `${b.booking_date}T${String(b.start_time).slice(0, 5)}` <= now;
  const inRange = (date) => date >= from && date <= to;

  const s = {
    revenueCents: 0,
    visits: 0,
    regular: { visits: 0, cents: 0 },
    newer: { visits: 0, cents: 0 },
    noShows: 0,
    replaced: 0,
    unmarked: 0,
    cancelled: 0,
    moved: 0,
    aheadVisits: 0,
    aheadCents: 0,
    depositsCents: 0,
    depositsCount: 0,
    feesCents: 0,
    keptCents: 0,
    keptCount: 0,
    refundedCents: 0,
    newClients: clientsCreated.filter((d) => inRange(d) && d <= today).length,
  };

  for (const b of bookings) {
    // Deposits: on the day they were paid.
    if (b.deposit_paid_at && inRange(b.deposit_paid_at) && b.deposit_cents > 0) {
      if (["paid", "refunded", "refund_pending"].includes(b.deposit_status)) {
        s.depositsCents += b.deposit_cents;
        s.depositsCount += 1;
        s.feesCents += depositFee(b.deposit_cents);
      }
      if (b.deposit_status === "refunded" || b.deposit_status === "refund_pending") s.refundedCents += b.deposit_cents;
    }

    if (!inRange(b.booking_date)) continue;

    if (b.status === "cancelled") {
      s.cancelled += 1;
      if (b.deposit_status === "paid" && b.deposit_cents > 0) {
        s.keptCents += b.deposit_cents;
        s.keptCount += 1;
      }
      continue;
    }
    if (b.status !== "confirmed") continue;
    if ((b.reschedule_count || 0) > 0) s.moved += 1;

    if (!started(b)) {
      s.aheadVisits += 1;
      s.aheadCents += b.price_cents || 0;
      continue;
    }
    if (b.outcome === "no_show") {
      s.noShows += 1;
      continue;
    }
    if (b.outcome === "replaced") {
      s.replaced += 1;
      continue;
    }
    if (!b.outcome) s.unmarked += 1;
    s.visits += 1;
    s.revenueCents += b.price_cents || 0;
    const group = b.client_id && regularIds.has(b.client_id) ? s.regular : s.newer;
    group.visits += 1;
    group.cents += b.price_cents || 0;
  }

  // Of the visits that should have happened, how many were no-shows.
  const expected = s.visits + s.noShows;
  s.noShowRate = expected > 0 ? s.noShows / expected : null;
  return s;
}

// The chart: one bar per week or month, split Regulars / New (cents).
export function revenueSeries({ bookings, regularIds, from, to, kind, now }) {
  const starts = bucketStarts(from, to, kind);
  const index = new Map(starts.map((d, i) => [d, i]));
  const rows = starts.map((start) => ({ start, regularCents: 0, newCents: 0, visits: 0 }));
  for (const b of bookings) {
    if (b.status !== "confirmed" || b.booking_date < from || b.booking_date > to) continue;
    if (`${b.booking_date}T${String(b.start_time).slice(0, 5)}` > now) continue;
    if (b.outcome === "no_show" || b.outcome === "replaced") continue;
    const row = rows[index.get(bucketOf(b.booking_date, kind))];
    if (!row) continue;
    row.visits += 1;
    if (b.client_id && regularIds.has(b.client_id)) row.regularCents += b.price_cents || 0;
    else row.newCents += b.price_cents || 0;
  }
  // Bars after today are left off (nothing has happened yet).
  const today = now.slice(0, 10);
  return rows.filter((r) => r.start <= today);
}

// Balances owed, any date: the amount written down, else price less a paid deposit.
export function owedTotals(bookings) {
  let count = 0;
  let cents = 0;
  for (const b of bookings) {
    if (b.status !== "confirmed" || b.outcome !== "completed_owed") continue;
    count += 1;
    cents +=
      b.owed_cents != null
        ? b.owed_cents
        : Math.max(0, (b.price_cents || 0) - (b.deposit_status === "paid" ? b.deposit_cents || 0 : 0));
  }
  return { count, cents };
}

export { addDays, daysBetween };

// Insights (the old Reports tab, plus more): plain functions, no database
// calls. Same rule as Reports: a visit "went ahead" if it's confirmed, has
// started, and wasn't a no-show or "someone else came".
import { addDays, daysBetween } from "@/lib/reports";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const PARTS = [
  ["morning", "Morning", "before 12"],
  ["afternoon", "Afternoon", "12 to 5"],
  ["evening", "Evening", "after 5"],
];
const dow = (t) => (new Date(`${t}T12:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
const partOf = (time) => {
  const h = Number(String(time).slice(0, 2));
  return h < 12 ? 0 : h < 17 ? 1 : 2;
};

// Who a booking is for: their client card, else their email, else their name
// (some bookings aren't linked to a client card).
export const clientKey = (b) =>
  b.client_id || (b.client_email ? `e:${String(b.client_email).toLowerCase()}` : b.client_name ? `n:${String(b.client_name).trim().toLowerCase()}` : null);

export const wentAhead = (b, now) =>
  b.status === "confirmed" && `${b.booking_date}T${String(b.start_time).slice(0, 5)}` <= now && b.outcome !== "no_show" && b.outcome !== "replaced";

/**
 * bookings: every booking from about a year back, plus upcoming ones:
 *   id, client_id, client_name, service_id, service_name, booking_date,
 *   start_time, status, outcome, price_cents, cancelled_at (ISO or null)
 * payments: tips etc. { kind, amount_cents, paid_on }
 * range: { from, to, prevFrom, prevTo }; now: local "YYYY-MM-DDTHH:MM";
 * tz: for late cancels; workingCells: Set of "d-p" the pro works.
 */
export function insights({ bookings, payments, range, now, today, workingCells }) {
  const inRange = (t) => t >= range.from && t <= range.to;
  const inPrev = (t) => t >= range.prevFrom && t <= range.prevTo;
  const ahead = bookings.filter((b) => wentAhead(b, now));
  const visits = ahead.filter((b) => inRange(b.booking_date));

  // Average ticket and tips.
  const revenue = visits.reduce((a, b) => a + (b.price_cents || 0), 0);
  const tips = payments.filter((p) => p.kind === "tip" && inRange(p.paid_on));
  const tipsCents = tips.reduce((a, p) => a + p.amount_cents, 0);

  // Each client's visits in date order, and whether they have one coming up.
  const byClient = new Map();
  for (const b of ahead) {
    if (!clientKey(b)) continue;
    (byClient.get(clientKey(b)) || byClient.set(clientKey(b), []).get(clientKey(b))).push(b);
  }
  for (const list of byClient.values()) list.sort((a, b) => (a.booking_date + a.start_time).localeCompare(b.booking_date + b.start_time));
  const upcoming = new Map();
  for (const b of bookings) {
    if (b.status !== "confirmed" || !clientKey(b) || wentAhead(b, now) || b.outcome) continue;
    if (`${b.booking_date}T${String(b.start_time).slice(0, 5)}` <= now) continue;
    const u = upcoming.get(clientKey(b));
    if (!u || b.booking_date < u.booking_date) upcoming.set(clientKey(b), b);
  }

  // Rebooking: visits in the period whose client has booked again since
  // (a later visit or one coming up).
  let rebookable = 0;
  let rebooked = 0;
  for (const b of visits) {
    if (!clientKey(b)) continue;
    rebookable += 1;
    const later = (byClient.get(clientKey(b)) || []).some((x) => x.booking_date > b.booking_date) || upcoming.has(clientKey(b));
    if (later) rebooked += 1;
  }

  // Retention: clients seen in the period before who came back in this one
  // (or are booked to).
  const prevClients = new Set(ahead.filter((b) => clientKey(b) && inPrev(b.booking_date)).map((b) => clientKey(b)));
  let kept = 0;
  for (const id of prevClients) {
    const back = (byClient.get(id) || []).some((x) => inRange(x.booking_date)) || (upcoming.get(id) && upcoming.get(id).booking_date <= range.to);
    if (back) kept += 1;
  }

  // New vs returning: a client's first visit ever is in this period.
  const seen = new Set();
  let newClients = 0;
  let returning = 0;
  for (const b of visits) {
    if (!clientKey(b) || seen.has(clientKey(b))) continue;
    seen.add(clientKey(b));
    const first = byClient.get(clientKey(b))?.[0];
    if (first && inRange(first.booking_date)) newClients += 1;
    else returning += 1;
  }

  // No-shows and late cancels (cancelled within 24 hours of the start;
  // counted from when cancel times started being saved).
  const noShows = bookings.filter((b) => b.status === "confirmed" && b.outcome === "no_show" && inRange(b.booking_date)).length;
  const lateCancels = bookings.filter((b) => {
    if (b.status !== "cancelled" || !b.cancelled_at || !inRange(b.booking_date)) return false;
    const startMs = Date.parse(`${b.booking_date}T${String(b.start_time).slice(0, 5)}:00Z`);
    // Both sides as "local clock as if UTC": cancelled_at was converted by the page.
    return startMs - Date.parse(`${b.cancelled_local}:00Z`) < 24 * 3600000;
  }).length;
  const expected = visits.length + noShows + lateCancels;

  // Busiest and slowest times: the last 12 weeks of visits (and booked ones).
  const grid = Array.from({ length: 7 }, () => [0, 0, 0]);
  const since = addDays(today, -84);
  for (const b of bookings) {
    if (b.status !== "confirmed" || b.outcome === "no_show" || b.outcome === "replaced") continue;
    if (b.booking_date < since || b.booking_date > addDays(today, 28)) continue;
    grid[dow(b.booking_date)][partOf(b.start_time)] += 1;
  }
  const cells = [];
  grid.forEach((row, d) => row.forEach((n, p) => cells.push({ d, p, n, working: workingCells.has(`${d}-${p}`) })));
  const worked = cells.filter((c) => c.working || c.n > 0);
  const busiest = [...worked].sort((a, b) => b.n - a.n).filter((c) => c.n > 0).slice(0, 2);
  const slowest = [...worked].filter((c) => c.working).sort((a, b) => a.n - b.n).slice(0, 2);
  const label = (c) => `${DAYS[c.d]} ${PARTS[c.p][1].toLowerCase()}s`;

  // Top services this period.
  const svc = new Map();
  for (const b of visits) {
    const k = b.service_name || "Other";
    const s = svc.get(k) || { name: k, visits: 0, cents: 0 };
    s.visits += 1;
    s.cents += b.price_cents || 0;
    svc.set(k, s);
  }
  const topServices = [...svc.values()].sort((a, b) => b.cents - a.cents || b.visits - a.visits).slice(0, 6);

  // Overdue: past their usual gap (or 8 weeks for one-visit clients) with
  // nothing booked.
  const overdue = [];
  for (const [id, list] of byClient) {
    if (upcoming.has(id)) continue;
    const last = list[list.length - 1];
    const linked = list.map((x) => x.client_id).filter(Boolean).pop() || null;
    const since = daysBetween(last.booking_date, today);
    let usual = null;
    if (list.length >= 2) {
      const gaps = [];
      for (let i = 1; i < list.length; i += 1) gaps.push(daysBetween(list[i - 1].booking_date, list[i].booking_date));
      gaps.sort((a, b) => a - b);
      usual = Math.max(7, gaps[Math.floor(gaps.length / 2)]);
    }
    const due = usual ? Math.max(Math.round(usual * 1.5), usual + 10) : 56;
    if (since >= due && since <= 400) overdue.push({ key: id, clientId: linked, bookingId: last.id, email: last.client_email || null, name: last.client_name, last: last.booking_date, since, usual, visits: list.length, serviceId: last.service_id, service: last.service_name, late: since - (usual || 42) });
  }
  overdue.sort((a, b) => b.visits - a.visits || b.late - a.late);

  return {
    visits: visits.length,
    avgTicketCents: visits.length ? Math.round(revenue / visits.length) : null,
    tipsCents,
    avgTipCents: visits.length && tipsCents ? Math.round(tipsCents / visits.length) : null,
    rebookRate: rebookable ? rebooked / rebookable : null,
    rebooked,
    rebookable,
    retention: prevClients.size ? kept / prevClients.size : null,
    kept,
    prevClients: prevClients.size,
    newClients,
    returning,
    noShowRate: expected ? noShows / expected : null,
    noShows,
    lateCancelRate: expected ? lateCancels / expected : null,
    lateCancels,
    grid,
    workingCells,
    busiest: busiest.map(label),
    slowest: slowest.map(label),
    topServices,
    overdue: overdue.slice(0, 20),
    overdueCount: overdue.length,
    DAYS,
  };
}

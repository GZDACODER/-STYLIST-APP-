// Home "Fill your book": how full this week is, how this month's money is
// growing against last month, and which one-tap moves to suggest. Plain
// functions with no database calls and no "@/" imports, so `npm test`
// (node --test) can load them directly. The Home page reads the rows and
// passes them in. See docs/superpowers/specs/2026-11-26-home-fill-your-book-design.md.

const LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// "09:30" or "09:30:00" → minutes after midnight.
const mins = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  return h * 60 + (m || 0);
};

// "YYYY-MM-DD" + n days, in UTC so the server's time zone never shifts it.
const addDays = (date, n) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

const pctOf = (part, whole) => (whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0);

/**
 * This week, Monday to Sunday. Booked = confirmed bookings (holds waiting for
 * a deposit don't count); offered = the openings' total. A day booked
 * without an opening counts as full rather than dividing by zero.
 */
export function weekFill({ week, today, nowTime, openings, bookings }) {
  const now = mins(nowTime);
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  let openMinLeft = 0;

  const days = LABELS.map((label, i) => {
    const date = addDays(week.start, i);
    const ops = openings.filter((o) => o.opening_date === date);
    const bks = confirmed.filter((b) => b.booking_date === date);
    const offeredMin = ops.reduce((a, o) => a + Math.max(0, mins(o.end_time) - mins(o.start_time)), 0);
    const bookedMin = bks.reduce((a, b) => a + Math.max(0, mins(b.end_time) - mins(b.start_time)), 0);
    const past = date < today;
    const isToday = date === today;

    // What's still to come: whole future days; today only after now.
    if (!past) {
      const from = isToday ? now : 0;
      const offeredAhead = ops.reduce((a, o) => a + Math.max(0, mins(o.end_time) - Math.max(mins(o.start_time), from)), 0);
      const bookedAhead = bks.reduce((a, b) => a + Math.max(0, mins(b.end_time) - Math.max(mins(b.start_time), from)), 0);
      openMinLeft += Math.max(0, offeredAhead - bookedAhead);
    }

    return {
      date,
      label,
      bookedMin,
      offeredMin,
      bookedCount: bks.length,
      pct: pctOf(bookedMin, Math.max(offeredMin, bookedMin)),
      past,
      isToday,
      hasOpenings: ops.length > 0,
    };
  });

  const bookedMin = days.reduce((a, d) => a + d.bookedMin, 0);
  const offeredMin = days.reduce((a, d) => a + d.offeredMin, 0);
  return {
    pct: pctOf(bookedMin, Math.max(offeredMin, bookedMin)),
    bookedCount: days.reduce((a, d) => a + d.bookedCount, 0),
    bookedMin,
    offeredMin,
    openMinLeft,
    days,
  };
}

// Running totals: [{ day, cents }] → [{ day, cum }].
const running = (list) => {
  let cum = 0;
  return list.map(({ day, cents }) => ({ day, cum: (cum += cents || 0) }));
};

/**
 * This month so far against last month. Both come from the same earnings
 * figure (lib/moneyTab earnings()), so the change compares like with like:
 * this month to today vs last month to the same day (clamped to its length).
 */
export function monthCurve({ thisDays, lastDays, todayDay }) {
  const points = running(thisDays.filter((d) => d.day <= todayDay));
  const lastPoints = running(lastDays);
  const total = points.length ? points.at(-1).cum : 0;
  const lastTotal = lastPoints.length ? lastPoints.at(-1).cum : 0;
  const same = lastPoints[Math.min(todayDay, lastPoints.length) - 1];
  const lastSameDays = same ? same.cum : 0;
  const changePct = lastSameDays > 0 ? Math.round(((total - lastSameDays) / lastSameDays) * 100) : null;
  return {
    total,
    points,
    lastPoints,
    lastSameDays,
    lastTotal,
    changePct,
    ahead: total > lastSameDays,
    passedLastMonth: lastTotal > 0 && total > lastTotal,
  };
}

/**
 * Up to 3 moves, in priority order: money owed, an overdue client to invite
 * back, a thin week ahead, then sharing the link (always possible, so there
 * is at least one). A pro without services or openings ahead gets setup
 * steps instead of owed / overdue.
 */
export function pickMoves({ owed, overdue, nextWeekOpenTimes, thisWeekOpenMinLeft, hasServices, hasOpeningsAhead, thinThreshold = 3 }) {
  const moves = [];
  if (!hasServices) moves.push({ kind: "setup-services" });
  if (!hasOpeningsAhead) moves.push({ kind: "setup-openings" });

  if (!moves.length) {
    const top = [...owed].sort((a, b) => b.owedCents - a.owedCents)[0];
    if (top) {
      moves.push({ kind: "owed", bookingId: top.bookingId, owedCents: top.owedCents, clientName: top.clientName, serviceName: top.serviceName, canEmail: Boolean(top.hasEmail) });
    }
    const eligible = overdue.filter((o) => o.hasEmail && !o.invitedRecently);
    if (eligible.length) {
      const o = eligible[0];
      moves.push({ kind: "overdue", clientId: o.clientId, bookingId: o.bookingId, serviceId: o.serviceId, name: o.name, usualWeeks: o.usualWeeks, sinceWeeks: o.sinceWeeks, more: eligible.length - 1 });
    }
    if (hasOpeningsAhead && nextWeekOpenTimes < thinThreshold) moves.push({ kind: "thin", nextWeekOpenTimes });
  }

  if (moves.length < 3) moves.push({ kind: "share", thisWeekOpenMinLeft });
  return moves.slice(0, 3);
}

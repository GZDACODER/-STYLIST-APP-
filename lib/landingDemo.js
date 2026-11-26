// The landing page's playable sample studio: a fixed week and month for one
// trade, and what each demo move does to it. Pure functions with relative
// imports only, so `npm test` can load them. Nothing here is real data,
// nothing is sent or saved. See
// docs/superpowers/specs/2026-11-26-landing-live-home-design.md.
import { monthCurve, weekFill } from "./homeFill.js";

// The fixture: week Mon 16 – Sun 22 November 2026, "today" Wednesday the 18th
// at noon. Fixed so the server and the browser render the same thing.
export const DEMO_WEEK = { start: "2026-11-16", end: "2026-11-22" };
export const DEMO_TODAY = "2026-11-18";
export const DEMO_NOW = "12:00";
export const DEMO_TODAY_DAY = 18;
const TODAY_DAY = DEMO_TODAY_DAY;

export const DEMO_NAMES = {
  stylist: { owed: "Maya", overdue: "Tasha" },
  barber: { owed: "Marcus", overdue: "Devon" },
  tattoo: { owed: "Rosa", overdue: "Jess" },
  tutor: { owed: "Sam", overdue: "Ava" },
};

const DATES = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"];
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

// Open Mon–Fri 9–5, Sat 10–2, closed Sunday.
const OPEN = [
  [0, "09:00", "17:00"],
  [1, "09:00", "17:00"],
  [2, "09:00", "17:00"],
  [3, "09:00", "17:00"],
  [4, "09:00", "17:00"],
  [5, "10:00", "14:00"],
];
// Booked at the start (~66%): Monday, Tuesday and Wednesday morning are done
// and full; the rest of the week has gaps to fill.
const BOOKED = [
  [0, "09:00", "17:00"],
  [1, "09:00", "17:00"],
  [2, "09:00", "12:00"],
  [2, "13:00", "15:00"],
  [3, "09:00", "12:00"],
  [3, "14:00", "16:00"],
  [4, "10:00", "12:00"],
  [5, "10:00", "11:00"],
];

const mins = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const clock = (m) => {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
};
const dollars = (cents) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: cents % 100 ? 2 : 0 })}`;

// One booking covering [from, to) on day i, priced as that many of the service.
function block(i, from, to, svc) {
  const length = mins(to) - mins(from);
  return {
    booking_date: DATES[i],
    start_time: from,
    end_time: to,
    status: "confirmed",
    service: svc.name,
    priceCents: svc.priceCents * Math.max(1, Math.round(length / svc.minutes)),
  };
}

// A believable month: closed Sundays, busier late in the week. This month
// reaches $2,140 by the 18th; last month ~12% less by the same day.
const WEIGHT = [0, 1, 1.1, 1, 1.2, 1.3, 0.8]; // Sun..Sat
function monthDays(length, firstDow, targetBy18) {
  const raw = Array.from({ length }, (_, i) => WEIGHT[(firstDow + i) % 7]);
  const scale = targetBy18 / raw.slice(0, TODAY_DAY).reduce((a, w) => a + w, 0);
  const days = raw.map((w, i) => ({ day: i + 1, cents: Math.round(w * scale) }));
  // Put the rounding remainder on the 17th so day 18 adds up exactly.
  const diff = targetBy18 - days.slice(0, TODAY_DAY).reduce((a, d) => a + d.cents, 0);
  days[16].cents += diff;
  return days;
}

// The trade's paid services only (a free consultation is never "owed").
const paid = (trade) => trade.services.filter((s) => s.priceCents > 0);

export function sampleStudio(trade) {
  const services = paid(trade);
  const names = DEMO_NAMES[trade.key] || DEMO_NAMES.stylist;
  const owedSvc = services[0];
  const inviteSvc = services[1] || services[0];
  return {
    trade,
    openings: OPEN.map(([i, from, to]) => ({ opening_date: DATES[i], start_time: from, end_time: to })),
    bookings: BOOKED.map(([i, from, to], n) => block(i, from, to, services[n % services.length])),
    thisDays: monthDays(30, 0, 214000), // November 2026 starts on a Sunday
    lastDays: monthDays(31, 4, 191000), // October 2026 starts on a Thursday
    owed: { name: names.owed, service: owedSvc.name, cents: owedSvc.priceCents },
    overdue: { name: names.overdue, service: inviteSvc.name, minutes: inviteSvc.minutes, cents: inviteSvc.priceCents, usualWeeks: 4, sinceWeeks: 6 },
    done: { remind: null, invite: null, share: null },
  };
}

// Free time still to come (from Wednesday noon on): [{ i, from, to }] in minutes.
function gaps(state) {
  const out = [];
  for (const [i, from, to] of OPEN) {
    const dayStart = DATES[i] < DEMO_TODAY ? null : DATES[i] === DEMO_TODAY ? Math.max(mins(from), mins(DEMO_NOW)) : mins(from);
    if (dayStart === null) continue;
    const taken = state.bookings
      .filter((b) => b.booking_date === DATES[i])
      .map((b) => [mins(b.start_time), mins(b.end_time)])
      .sort((a, b) => a[0] - b[0]);
    let at = dayStart;
    for (const [s, e] of taken) {
      if (e <= at) continue;
      if (s > at) out.push({ i, from: at, to: Math.min(s, mins(to)) });
      at = Math.max(at, e);
    }
    if (at < mins(to)) out.push({ i, from: at, to: mins(to) });
  }
  return out.filter((g) => g.to > g.from);
}

const addToToday = (days, cents) => days.map((d) => (d.day === TODAY_DAY ? { ...d, cents: d.cents + cents } : d));

/**
 * One demo move. Pure: returns a new state and the sentence to announce. A
 * move already done returns the same state and an empty announcement.
 */
export function applyMove(state, kind) {
  if (state.done[kind]) return { state, announce: "" };

  if (kind === "remind") {
    const { name, cents } = state.owed;
    return {
      state: { ...state, thisDays: addToToday(state.thisDays, cents), done: { ...state.done, remind: "Reminder sent (sample)" } },
      announce: `${name} paid ${dollars(cents)} (sample).`,
    };
  }

  if (kind === "invite") {
    const { name, service, minutes, cents } = state.overdue;
    const slot = gaps(state).find((g) => g.to - g.from >= minutes);
    const done = { ...state.done, invite: "Invited (sample)" };
    if (!slot) {
      return {
        state: { ...state, thisDays: addToToday(state.thisDays, cents), done },
        announce: `${name} booked next week (sample).`,
      };
    }
    const booking = { booking_date: DATES[slot.i], start_time: hhmm(slot.from), end_time: hhmm(slot.from + minutes), status: "confirmed", service, priceCents: cents };
    return {
      state: { ...state, bookings: [...state.bookings, booking], thisDays: addToToday(state.thisDays, cents), done },
      announce: `${name} booked ${WEEKDAYS[slot.i]} at ${clock(slot.from)} (sample).`,
    };
  }

  // share: every remaining open time gets booked.
  const services = paid(state.trade);
  const added = gaps(state).map((g, n) => block(g.i, hhmm(g.from), hhmm(g.to), services[n % services.length]));
  const cents = added.reduce((a, b) => a + b.priceCents, 0);
  return {
    state: { ...state, bookings: [...state.bookings, ...added], thisDays: addToToday(state.thisDays, cents), done: { ...state.done, share: "Link shared (sample)" } },
    announce: "Your link filled the week (sample). Fully booked.",
  };
}

// The numbers the Home cards draw, from the same calculations as the app.
export function demoView(state) {
  const week = weekFill({ week: DEMO_WEEK, today: DEMO_TODAY, nowTime: DEMO_NOW, openings: state.openings, bookings: state.bookings });
  const month = monthCurve({ thisDays: state.thisDays, lastDays: state.lastDays, todayDay: TODAY_DAY });
  return { week: { ...week, examples: false }, month: { ...month, depositsCents: 0, examples: false } };
}

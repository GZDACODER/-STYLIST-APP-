// Personal events on the Calendar (birthdays, practices...). Safe to use in
// the browser. The rules match the database's calendar_event_on (steps 29
// and 34 SQL).
import { parseDateString } from "@/lib/availability";

export const REPEATS = ["none", "daily", "weekly", "biweekly", "monthly", "yearly"];
export const MONTHLY_MODES = ["date", "weekday", "last_weekday"];

// Event colours: { key: [label, colour] }. Keys match the database check.
export const COLORS = {
  gray: ["Gray", "#8f8a80"],
  gold: ["Gold", "#b8975a"],
  rose: ["Rose", "#c0577a"],
  blue: ["Blue", "#4a78b8"],
  green: ["Green", "#3d8a5c"],
  purple: ["Purple", "#7d5bb5"],
};
export const colorOf = (event) => (COLORS[event?.color] || COLORS.gray)[1];

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const utc = (text) => {
  const [y, m, d] = text.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
// Whole days from a to b ("YYYY-MM-DD"), safe across daylight saving changes.
const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / DAY_MS);
const weekday = (text) => new Date(utc(text)).getUTCDay();
const dayOfMonth = (text) => Number(text.slice(8, 10));
const nthInMonth = (text) => Math.ceil(dayOfMonth(text) / 7);
// Is this the last such weekday of its month (no same weekday 7 days later)?
const isLastInMonth = (text) => new Date(utc(text) + 7 * DAY_MS).getUTCMonth() !== new Date(utc(text)).getUTCMonth();

// Does this event happen on dateText ("YYYY-MM-DD")?
export function eventOccursOn(event, dateText) {
  if (dateText < event.starts_on) return false;
  if (event.repeat_until && dateText > event.repeat_until) return false;
  if ((event.skipped_dates || []).includes(dateText)) return false;
  const diff = daysBetween(event.starts_on, dateText);
  const days = event.repeat_days || [];
  const dow = weekday(dateText);
  switch (event.repeats) {
    case "daily":
      return true;
    case "weekly":
      return days.length ? days.includes(dow) : diff % 7 === 0;
    case "biweekly": {
      // Weeks counted from the Sunday of the first date's week.
      const fromSunday = diff + weekday(event.starts_on);
      return Math.floor(fromSunday / 7) % 2 === 0 && (days.length ? days.includes(dow) : dow === weekday(event.starts_on));
    }
    case "monthly":
      if (event.monthly_mode === "weekday") {
        return dow === weekday(event.starts_on) && nthInMonth(dateText) === nthInMonth(event.starts_on);
      }
      if (event.monthly_mode === "last_weekday") {
        return dow === weekday(event.starts_on) && isLastInMonth(dateText);
      }
      return dayOfMonth(dateText) === dayOfMonth(event.starts_on);
    case "yearly":
      return dateText.slice(5) === event.starts_on.slice(5);
    default:
      return diff === 0;
  }
}

// The events on one date, all-day ones first, then by start time.
export function eventsOn(events, dateText) {
  return events
    .filter((e) => eventOccursOn(e, dateText))
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || "") || a.title.localeCompare(b.title));
}

const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

const dayList = (days) => {
  const names = [...days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_SHORT[d]);
  return names.length <= 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

// "Every Tuesday", "Every Tue and Thu", "Every month on the 3rd Monday"...
// dateText: the first date. opts: { days, mode } (repeat_days, monthly_mode).
export function repeatLabel(repeats, dateText, { days = [], mode = "date" } = {}) {
  if (!dateText || repeats === "none") return "Doesn't repeat";
  const date = parseDateString(dateText);
  const wd = WEEKDAY_NAMES[date.getDay()];
  if (repeats === "daily") return "Every day";
  if (repeats === "weekly") return days.length > 1 || (days.length === 1 && days[0] !== date.getDay()) ? `Every ${dayList(days)}` : `Every ${wd}`;
  if (repeats === "biweekly") return days.length > 1 || (days.length === 1 && days[0] !== date.getDay()) ? `Every other week on ${dayList(days)}` : `Every other ${wd}`;
  if (repeats === "monthly") {
    if (mode === "weekday") return `Every month on the ${ordinal(nthInMonth(dateText))} ${wd}`;
    if (mode === "last_weekday") return `Every month on the last ${wd}`;
    return `Every month on the ${ordinal(date.getDate())}`;
  }
  if (repeats === "yearly") {
    return `Every year on ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  return "Doesn't repeat";
}

// For the form: the monthly choices that make sense for this first date.
export function monthlyChoices(dateText) {
  if (!dateText) return [["date", "On the same date"]];
  const out = [
    ["date", repeatLabel("monthly", dateText, { mode: "date" })],
    ["weekday", repeatLabel("monthly", dateText, { mode: "weekday" })],
  ];
  if (isLastInMonth(dateText)) out.push(["last_weekday", repeatLabel("monthly", dateText, { mode: "last_weekday" })]);
  // A 5th weekday is only in some months: offer "last" instead.
  if (nthInMonth(dateText) === 5) out.splice(1, 1);
  return out;
}

export const weekdayOf = weekday;
export { WEEKDAY_SHORT };

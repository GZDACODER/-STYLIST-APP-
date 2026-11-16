// Personal events on the Calendar (birthdays, practices...). Safe to use in
// the browser. The rules match the database's calendar_event_on (step 29 SQL).
import { parseDateString } from "@/lib/availability";

export const REPEATS = ["none", "weekly", "biweekly", "monthly", "yearly"];

const DAY_MS = 24 * 60 * 60 * 1000;
// Whole days from a to b ("YYYY-MM-DD"), safe across daylight saving changes.
function daysBetween(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / DAY_MS);
}

// Does this event happen on dateText ("YYYY-MM-DD")?
export function eventOccursOn(event, dateText) {
  if (dateText < event.starts_on) return false;
  if (event.repeat_until && dateText > event.repeat_until) return false;
  if ((event.skipped_dates || []).includes(dateText)) return false;
  const diff = daysBetween(event.starts_on, dateText);
  const [, sm, sd] = event.starts_on.split("-");
  const [, m, d] = dateText.split("-");
  switch (event.repeats) {
    case "weekly":
      return diff % 7 === 0;
    case "biweekly":
      return diff % 14 === 0;
    case "monthly":
      return d === sd;
    case "yearly":
      return m === sm && d === sd;
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

// "Every Tuesday", "Every month on the 16th", "Every year on Nov 16"...
// dateText: the first date.
export function repeatLabel(repeats, dateText) {
  if (!dateText || repeats === "none") return "Doesn't repeat";
  const date = parseDateString(dateText);
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  if (repeats === "weekly") return `Every ${weekday}`;
  if (repeats === "biweekly") return `Every other ${weekday}`;
  if (repeats === "monthly") return `Every month on the ${ordinal(date.getDate())}`;
  if (repeats === "yearly") {
    return `Every year on ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  return "Doesn't repeat";
}

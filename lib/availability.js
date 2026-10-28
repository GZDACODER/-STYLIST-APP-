// Helpers shared by the availability page and its server actions.

// Shown Monday first. "dow" matches JavaScript's getDay(): 0 = Sunday.
export const WEEKDAYS = [
  { dow: 1, name: "Monday", short: "Mon" },
  { dow: 2, name: "Tuesday", short: "Tue" },
  { dow: 3, name: "Wednesday", short: "Wed" },
  { dow: 4, name: "Thursday", short: "Thu" },
  { dow: 5, name: "Friday", short: "Fri" },
  { dow: 6, name: "Saturday", short: "Sat" },
  { dow: 0, name: "Sunday", short: "Sun" },
];

// Used to fill the form before a stylist has saved any hours.
export const DEFAULT_HOURS = { is_working: true, start_time: "09:00", end_time: "17:00" };

// Turns the saved rows into { 0: {...}, 1: {...}, ... 6: {...} }.
// Postgres sends times like "09:00:00"; the form wants "09:00".
export function hoursByWeekday(rows) {
  const byDay = {};
  for (const row of rows || []) {
    byDay[row.weekday] = {
      is_working: row.is_working,
      start_time: row.start_time ? row.start_time.slice(0, 5) : "",
      end_time: row.end_time ? row.end_time.slice(0, 5) : "",
    };
  }
  return byDay;
}

// "09:00" -> "9 AM", "17:30" -> "5:30 PM". Short enough for a calendar box.
// (\u00a0 is a space that never breaks onto a new line.)
export function shortTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const minutes = m ? `:${String(m).padStart(2, "0")}` : "";
  return `${hour12}${minutes}\u00a0${suffix}`;
}

// Dates are handled as plain "YYYY-MM-DD" text so time zones can't shift them.
export function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "2026-11-03" -> a Date at local midnight (avoids the UTC shift of new Date("2026-11-03")).
export function parseDateString(text) {
  const [y, m, d] = text.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isValidDateString(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  return toDateString(parseDateString(text)) === text;
}

// "2026-11-03" -> "Tue, Nov 3, 2026"
export function formatDate(text) {
  return parseDateString(text).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// "09:15" or "09:15:00" -> "9:15 AM"
export function clockTime(text) {
  const [h, m] = text.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

// Today's date ("YYYY-MM-DD") in a given time zone, e.g. "America/Chicago".
export function todayInTimeZone(timeZone) {
  // The "en-CA" format happens to be YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return Boolean(timeZone);
  } catch {
    return false;
  }
}

export const DEFAULT_TIME_ZONE = "America/Chicago";

// US time zones, listed first in the time zone picker.
export const US_TIME_ZONES = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Phoenix", label: "Arizona" },
  { value: "America/Los_Angeles", label: "Pacific" },
  { value: "America/Anchorage", label: "Alaska" },
  { value: "Pacific/Honolulu", label: "Hawaii" },
];

// "America/Chicago" -> "Central", "Europe/London" -> "London"
export function timeZoneLabel(timeZone) {
  const us = US_TIME_ZONES.find((z) => z.value === timeZone);
  if (us) return us.label;
  return timeZone.split("/").pop().replace(/_/g, " ");
}

// Every 15 minutes of the day as "HH:MM", for the time pickers.
export const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, "0");
  const m = String((i % 4) * 15).padStart(2, "0");
  return `${h}:${m}`;
});

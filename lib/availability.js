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

// "09:00" -> "9am", "17:30" -> "5:30pm". Short enough for a calendar box.
export function shortTime(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hour12}:${String(m).padStart(2, "0")}${suffix}` : `${hour12}${suffix}`;
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

// "America/New_York" -> "New York"
export function timeZoneLabel(timeZone) {
  return timeZone.split("/").pop().replace(/_/g, " ");
}

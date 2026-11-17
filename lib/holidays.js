// US holidays for the Calendar, worked out for any year (nothing to update).
// Federal holidays are the days banks, post offices and schools close. The
// others are busy days for beauty pros (people want their hair done before
// them). Shown on the actual date, not the "observed" weekday.

// The nth weekday (0 = Sunday) of a month; n = -1 for the last one.
function nthWeekday(year, month, weekday, n) {
  if (n > 0) {
    const first = new Date(year, month, 1).getDay();
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  }
  const lastDay = new Date(year, month + 1, 0);
  return lastDay.getDate() - ((lastDay.getDay() - weekday + 7) % 7);
}

// Easter Sunday (the Gregorian "computus").
function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

const pad = (n) => String(n).padStart(2, "0");
const key = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;

const cache = new Map();

// { "YYYY-MM-DD": [{ name, federal }] } for one year.
export function holidaysForYear(year) {
  if (cache.has(year)) return cache.get(year);
  // [month, day, name, federal key or null]. The keys match the database's
  // us_federal_holidays() (step 34 SQL), used for "Close on holidays".
  const list = [
    [0, 1, "New Year's Day", "new_years"],
    [0, nthWeekday(year, 0, 1, 3), "Martin Luther King Jr. Day", "mlk"],
    [1, 14, "Valentine's Day", null],
    [1, nthWeekday(year, 1, 1, 3), "Presidents' Day", "presidents"],
    [...easter(year), "Easter", null],
    [4, nthWeekday(year, 4, 0, 2), "Mother's Day", null],
    [4, nthWeekday(year, 4, 1, -1), "Memorial Day", "memorial"],
    [5, nthWeekday(year, 5, 0, 3), "Father's Day", null],
    [5, 19, "Juneteenth", "juneteenth"],
    [6, 4, "Independence Day", "independence"],
    [8, nthWeekday(year, 8, 1, 1), "Labor Day", "labor"],
    [9, nthWeekday(year, 9, 1, 2), "Columbus Day / Indigenous Peoples' Day", "columbus"],
    [9, 31, "Halloween", null],
    [10, 11, "Veterans Day", "veterans"],
    [10, nthWeekday(year, 10, 4, 4), "Thanksgiving", "thanksgiving"],
    [10, nthWeekday(year, 10, 4, 4) + 1, "Black Friday", null],
    [11, 24, "Christmas Eve", null],
    [11, 25, "Christmas Day", "christmas"],
    [11, 31, "New Year's Eve", null],
  ];
  const byDate = {};
  for (const [month, day, name, holidayKey] of list) {
    (byDate[key(year, month, day)] ||= []).push({ name, federal: Boolean(holidayKey), key: holidayKey });
  }
  cache.set(year, byDate);
  return byDate;
}

// The holidays on one date ("YYYY-MM-DD"), or [].
export function holidaysOn(dateText) {
  return holidaysForYear(Number(dateText.slice(0, 4)))[dateText] || [];
}

// The 11 federal holidays, in calendar order: [{ key, name }].
export const FEDERAL_HOLIDAYS = [
  { key: "new_years", name: "New Year's Day" },
  { key: "mlk", name: "Martin Luther King Jr. Day" },
  { key: "presidents", name: "Presidents' Day" },
  { key: "memorial", name: "Memorial Day" },
  { key: "juneteenth", name: "Juneteenth" },
  { key: "independence", name: "Independence Day" },
  { key: "labor", name: "Labor Day" },
  { key: "columbus", name: "Columbus Day / Indigenous Peoples' Day" },
  { key: "veterans", name: "Veterans Day" },
  { key: "thanksgiving", name: "Thanksgiving" },
  { key: "christmas", name: "Christmas Day" },
];

// The next date ("YYYY-MM-DD") of a federal holiday, on or after fromDate.
export function nextHolidayDate(holidayKey, fromDate) {
  const year = Number(fromDate.slice(0, 4));
  for (const y of [year, year + 1]) {
    const hit = Object.entries(holidaysForYear(y)).find(
      ([date, list]) => date >= fromDate && list.some((h) => h.key === holidayKey)
    );
    if (hit) return hit[0];
  }
  return null;
}

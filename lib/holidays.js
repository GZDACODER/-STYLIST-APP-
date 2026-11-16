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
  const list = [
    [0, 1, "New Year's Day", true],
    [0, nthWeekday(year, 0, 1, 3), "Martin Luther King Jr. Day", true],
    [1, 14, "Valentine's Day", false],
    [1, nthWeekday(year, 1, 1, 3), "Presidents' Day", true],
    [...easter(year), "Easter", false],
    [4, nthWeekday(year, 4, 0, 2), "Mother's Day", false],
    [4, nthWeekday(year, 4, 1, -1), "Memorial Day", true],
    [5, nthWeekday(year, 5, 0, 3), "Father's Day", false],
    [5, 19, "Juneteenth", true],
    [6, 4, "Independence Day", true],
    [8, nthWeekday(year, 8, 1, 1), "Labor Day", true],
    [9, nthWeekday(year, 9, 1, 2), "Columbus Day / Indigenous Peoples' Day", true],
    [9, 31, "Halloween", false],
    [10, 11, "Veterans Day", true],
    [10, nthWeekday(year, 10, 4, 4), "Thanksgiving", true],
    [10, nthWeekday(year, 10, 4, 4) + 1, "Black Friday", false],
    [11, 24, "Christmas Eve", false],
    [11, 25, "Christmas Day", true],
    [11, 31, "New Year's Eve", false],
  ];
  const byDate = {};
  for (const [month, day, name, federal] of list) {
    (byDate[key(year, month, day)] ||= []).push({ name, federal });
  }
  cache.set(year, byDate);
  return byDate;
}

// The holidays on one date ("YYYY-MM-DD"), or [].
export function holidaysOn(dateText) {
  return holidaysForYear(Number(dateText.slice(0, 4)))[dateText] || [];
}

// Plain-words descriptions of a standing appointment, used on the client
// card and the Calendar. Safe to use on the server and in the browser.
import { WEEKDAYS, clockTime, parseDateString } from "@/lib/availability";

const dayName = (dow) => WEEKDAYS.find((d) => d.dow === Number(dow))?.name || "";

// "Nov 10" (the year only when it isn't this year).
export function shortDay(text) {
  const day = parseDateString(text);
  return day.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(day.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
  });
}

// "Every 2 weeks · Tuesday at 10:00 AM"
export function repeatLine(series) {
  return `Every ${series.interval_weeks} weeks · ${dayName(series.weekday)} at ${clockTime(series.start_time)}`;
}

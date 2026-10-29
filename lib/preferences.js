// What a waitlisted client would like: days of the week and times of day.
// Shared by the booking page, the waitlist emails and the dashboard.
import { WEEKDAYS } from "@/lib/availability";

// Must match waitlist_part_of_day() in the database.
export const PARTS_OF_DAY = [
  { value: "morning", label: "Mornings", hint: "before noon" },
  { value: "afternoon", label: "Afternoons", hint: "noon to 5 PM" },
  { value: "evening", label: "Evenings", hint: "after 5 PM" },
];

// ([1, 6], ["morning"]) -> "Mon, Sat · Mornings". Empty lists mean "any".
export function describeWishes(days, times) {
  const dayText = days?.length
    ? WEEKDAYS.filter((d) => days.includes(d.dow))
        .map((d) => d.short)
        .join(", ")
    : "Any day";
  const timeText = times?.length
    ? PARTS_OF_DAY.filter((p) => times.includes(p.value))
        .map((p) => p.label)
        .join(", ")
    : "any time";
  return `${dayText} · ${timeText}`;
}

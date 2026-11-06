// "2026-11-06T14:30": the date and time right now in a time zone, in a form
// that compares correctly as text with a booking's date + start time.
export function nowLocal(timeZone) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date())
    .replace(" ", "T");
}

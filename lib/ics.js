// Calendar files (.ics) for Calendar sync: a pro's bookings as events that
// Google Calendar, iPhone Calendar and Outlook can subscribe to. Times are
// sent in UTC, worked out from the business's time zone.

// "2026-11-24", "10:00:00", "America/Chicago" -> the UTC Date for that moment.
export function zonedToUtc(dateText, timeText, timeZone) {
  const [y, m, d] = dateText.split("-").map(Number);
  const [hh, mm] = String(timeText).split(":").map(Number);
  const wanted = Date.UTC(y, m - 1, d, hh, mm);
  // Guess, see what that is on the zone's clock, and correct (twice, for
  // the hours around a daylight-saving change).
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
        .formatToParts(new Date(guess))
        .map((p) => [p.type, p.value])
    );
    const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
    guess += wanted - shown;
  }
  return new Date(guess);
}

const stamp = (date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

// Text values: escape \ ; , and line breaks.
const esc = (text) =>
  String(text ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

// Lines longer than 75 bytes are folded (a line break and a space).
function fold(line) {
  const out = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

// events: [{ uid, start: Date, end: Date, title, description, location, url, cancelled }]
export function buildCalendar({ name, events, refreshHours = 2 }) {
  const now = stamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Clientele//Bookings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
    `REFRESH-INTERVAL;VALUE=DURATION:PT${refreshHours}H`,
    `X-PUBLISHED-TTL:PT${refreshHours}H`,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${esc(e.uid)}`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${esc(e.title)}`,
      ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
      ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
      ...(e.url ? [`URL:${esc(e.url)}`] : []),
      `STATUS:${e.cancelled ? "CANCELLED" : "CONFIRMED"}`,
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

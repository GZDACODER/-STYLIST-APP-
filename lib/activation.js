// Launch-week dashboard (/dashboard/admin/launch): where each new pro is on
// the way to their first booking, how long they've been there, and a short
// personal note the owner can send from their own email. Pure: the page
// gathers the facts. Relative imports only (npm test loads it).

export const STAGES = [
  { key: "signed_up", label: "Signed up", next: "Add services" },
  { key: "services", label: "Services added", next: "Open times" },
  { key: "bookable", label: "Bookable", next: "First booking" },
  { key: "booked", label: "First booking", next: "Keep going" },
];

// Days on a setup step before a pro counts as stuck.
export const STUCK_DAYS = 2;

const DAY = 86400000;
const daysSince = (iso, now) => (iso ? Math.max(0, Math.floor((now - Date.parse(iso)) / DAY)) : null);

// p: { createdAt, services, servicesAt, openingsAhead, openingsAt, clientBookings, firstBookingAt }
// (servicesAt / openingsAt: when the latest one was added; firstBookingAt: the first client booking).
export function activation(p, now = Date.now()) {
  let stage = "signed_up";
  let since = p.createdAt;
  if ((p.clientBookings || 0) > 0) {
    stage = "booked";
    since = p.firstBookingAt || p.createdAt;
  } else if ((p.services || 0) > 0 && (p.openingsAhead || 0) > 0) {
    stage = "bookable";
    since = p.openingsAt || p.servicesAt || p.createdAt;
  } else if ((p.services || 0) > 0) {
    stage = "services";
    since = p.servicesAt || p.createdAt;
  }
  const daysStuck = daysSince(since, now) ?? 0;
  return {
    stage,
    step: STAGES.findIndex((s) => s.key === stage),
    daysStuck,
    stuck: stage !== "booked" && daysStuck >= STUCK_DAYS,
    lastSeenDays: daysSince(p.lastSignInAt, now),
    signedUpDays: daysSince(p.createdAt, now) ?? 0,
  };
}

const WORDS = { tutor: "students" };

// The note for a pro at a stage: { subject, body }, in the owner's voice.
// base: the site (https://www.clientelesuite.com).
export function nudge(p, stage, base) {
  const hi = p.firstName ? `Hi ${p.firstName},` : "Hi,";
  const biz = p.businessName || "your business";
  const clients = WORDS[p.trade] || "clients";
  const reply = "If anything's unclear or missing, just reply. I read every message.";
  const notes = {
    signed_up: {
      subject: `Getting ${biz} ready to book`,
      lines: [
        `Thanks for signing up ${biz} on Clientele. I'm the founder, and I wanted to help you get your first booking.`,
        `The first step is your services: what ${clients} can book, with prices and times. There's a "Use these services" button that starts you with examples you can edit:`,
        `${base}/dashboard/services`,
        reply,
      ],
    },
    services: {
      subject: `One step left for ${biz}`,
      lines: [
        `Your services are in. The last step before ${clients} can book is opening some times. ${clients[0].toUpperCase() + clients.slice(1)} only see the times you open here:`,
        `${base}/dashboard/openings`,
        reply,
      ],
    },
    bookable: {
      subject: `${biz} is ready for bookings`,
      lines: [
        `Your booking page is live: ${base}/book/${p.slug}`,
        `The quickest first booking usually comes from texting that link to a few regular ${clients}, or putting it in your Instagram bio. The Share kit has ready-made posts and a QR code:`,
        `${base}/dashboard/share`,
        reply,
      ],
    },
    booked: {
      subject: "How's it going with Clientele?",
      lines: [
        `Your first bookings are coming in. How's it going so far? Anything confusing, missing or slower than it should be?`,
        `A one-line reply helps me a lot.`,
      ],
    },
  };
  const n = notes[stage] || notes.signed_up;
  return { subject: n.subject, body: [hi, "", ...n.lines.flatMap((l) => [l, ""]), "Thanks,"].join("\n") };
}

// Our own test and demo accounts, hidden by default.
export function looksLikeTest(p) {
  const email = String(p.email || "").toLowerCase();
  return email.includes("+") || email.endsWith("@clientelesuite.com") || /\b(test|launch check)\b/i.test(String(p.businessName || ""));
}

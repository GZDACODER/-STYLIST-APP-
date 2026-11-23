// "Manage my appointment" (/v/<code>): the booking behind the link in every
// confirmation and reminder email. The code is the booking's own 64-letter
// cancel_token: unguessable, for that one booking only. Server only.
import { createAdminClient } from "@/lib/supabase/admin";
import { zonedToUtc } from "@/lib/ics";
import { templateFor } from "@/lib/templates";

export const TOKEN_RE = /^[0-9a-f]{64}$/;
export const manageUrl = (base, token) => `${base}/v/${token}`;

function nowLocal(timeZone) {
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

// The visit, its pro and what can be done now. null if the link doesn't match.
export async function loadVisitForManage(token) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return null;
  const { data: b } = await createAdminClient()
    .from("bookings")
    .select(
      "id, status, service_name, booking_date, start_time, end_time, price_cents, deposit_cents, deposit_status, cancellation_policy, client_name, standing_series_id, stylist:stylists(slug, business_name, timezone, location, pro_code, business_type, modules, reply_email)"
    )
    .eq("cancel_token", token)
    .maybeSingle();
  if (!b?.stylist) return null;
  const s = b.stylist;
  const now = nowLocal(s.timezone);
  const startsAt = `${b.booking_date}T${b.start_time.slice(0, 5)}`;
  const endsAt = `${b.booking_date}T${b.end_time.slice(0, 5)}`;
  const tpl = templateFor(s.business_type, s.modules);
  const start = zonedToUtc(b.booking_date, b.start_time, s.timezone);
  const end = zonedToUtc(b.booking_date, b.end_time, s.timezone);
  const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const google = `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: `${b.service_name} · ${s.business_name}`,
    dates: `${stamp(start)}/${stamp(end)}`,
    details: `Your ${b.service_name} with ${s.business_name}.`,
    ...(s.location ? { location: s.location } : {}),
  })}`;
  const location = String(s.location || "").trim();
  const online = /^https?:\/\//i.test(location);
  return {
    ...b,
    stylist: s,
    words: tpl.words,
    confirmed: b.status === "confirmed",
    upcoming: b.status === "confirmed" && startsAt > now,
    ended: endsAt <= now,
    today: b.booking_date === now.slice(0, 10) && endsAt > now,
    google,
    location,
    online,
    directions: location && !online ? `https://maps.apple.com/?q=${encodeURIComponent(location)}` : null,
  };
}

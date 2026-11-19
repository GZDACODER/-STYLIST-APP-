// Calendar sync: a pro's private calendar link (Settings -> Calendar sync).
// Google Calendar, iPhone Calendar and Outlook read it every few hours and
// show the bookings in the pro's own calendar. No login: the long random
// code in the address is the key, and the pro can reset it.
import { createAdminClient } from "@/lib/supabase/admin";
import { todayInTimeZone } from "@/lib/availability";
import { formatPrice } from "@/lib/money";
import { publicSiteUrl } from "@/lib/siteUrl";
import { buildCalendar, zonedToUtc } from "@/lib/ics";
import { reportError } from "@/lib/errorAlerts";

export const dynamic = "force-dynamic";

const shift = (date, days) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export async function GET(request, { params }) {
  const { token: raw } = await params;
  const token = String(raw || "").replace(/\.ics$/i, "");
  if (!/^[0-9a-f]{48}$/.test(token)) return new Response("Not found", { status: 404 });

  try {
    const admin = createAdminClient();
    const { data: feed } = await admin.from("calendar_feeds").select("stylist_id, last_read_at").eq("token", token).maybeSingle();
    if (!feed) return new Response("Not found", { status: 404 });

    const { data: stylist } = await admin
      .from("stylists")
      .select("business_name, timezone, location")
      .eq("id", feed.stylist_id)
      .maybeSingle();
    if (!stylist) return new Response("Not found", { status: 404 });

    const today = todayInTimeZone(stylist.timezone);
    const { data: rows, error } = await admin
      .from("bookings")
      .select("id, booking_date, start_time, end_time, service_name, price_cents, client_name, client_email, client_phone, deposit_cents, deposit_status")
      .eq("stylist_id", feed.stylist_id)
      .eq("status", "confirmed")
      .gte("booking_date", shift(today, -60))
      .lte("booking_date", shift(today, 365))
      .order("booking_date")
      .limit(5000);
    if (error) throw new Error(error.message);

    const site = publicSiteUrl("https://www.clientelesuite.com");
    const events = (rows || []).map((b) => ({
      uid: `booking-${b.id}@clientelesuite.com`,
      start: zonedToUtc(b.booking_date, b.start_time, stylist.timezone),
      end: zonedToUtc(b.booking_date, b.end_time, stylist.timezone),
      title: `${b.service_name} · ${b.client_name}`,
      description: [
        `${b.service_name}${b.price_cents ? ` · ${formatPrice(b.price_cents)}` : ""}`,
        b.client_phone && `Phone: ${b.client_phone}`,
        b.client_email && `Email: ${b.client_email}`,
        b.deposit_cents > 0 && `Deposit: ${formatPrice(b.deposit_cents)}${b.deposit_status === "paid" ? " paid" : ""}`,
        "Booked on Clientele",
      ]
        .filter(Boolean)
        .join("\n"),
      location: /^https?:/.test(stylist.location || "") ? "" : stylist.location || "",
      url: `${site}/dashboard/bookings`,
    }));

    // Note when it was last read (at most once an hour), so Settings can say
    // the calendar is connected.
    if (!feed.last_read_at || Date.now() - new Date(feed.last_read_at).getTime() > 60 * 60 * 1000) {
      await admin.from("calendar_feeds").update({ last_read_at: new Date().toISOString() }).eq("token", token);
    }

    return new Response(buildCalendar({ name: `${stylist.business_name} · Clientele`, events }), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="clientele.ics"',
        "Cache-Control": "private, max-age=300",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    await reportError("Calendar sync", error);
    return new Response("Calendar unavailable", { status: 500 });
  }
}

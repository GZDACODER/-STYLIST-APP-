// /client/<pro ID>/calendar/<booking id>: one visit as a calendar file, for
// Apple Calendar and Outlook ("Add to calendar"). Only for the signed-in
// client's own upcoming visits.
import { createBookingClient } from "@/lib/supabase/booking";
import { buildCalendar, zonedToUtc } from "@/lib/ics";
import { publicSiteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { code, id } = await params;
  const supabase = await createBookingClient();
  const { data: home } = await supabase.rpc("client_home", { p_code: String(code) });
  if (!home) return new Response("Not found", { status: 404 });
  const { data: rows } = await supabase.rpc("get_my_bookings", { p_slug: home.slug });
  const b = (rows || []).find((r) => r.id === String(id).replace(/\.ics$/, ""));
  if (!b) return new Response("Not found", { status: 404 });
  const ics = buildCalendar({
    name: home.business_name,
    events: [
      {
        uid: `visit-${b.id}@clientelesuite.com`,
        start: zonedToUtc(b.booking_date, b.start_time, home.timezone),
        end: zonedToUtc(b.booking_date, b.end_time, home.timezone),
        title: `${b.service_name} · ${home.business_name}`,
        description: `Your ${b.service_name} with ${home.business_name}. Change or cancel: ${publicSiteUrl("https://www.clientelesuite.com")}/client/${home.pro_code}`,
        url: `${publicSiteUrl("https://www.clientelesuite.com")}/client/${home.pro_code}`,
      },
    ],
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${home.business_name.replace(/[^A-Za-z0-9]+/g, "-")}-visit.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}

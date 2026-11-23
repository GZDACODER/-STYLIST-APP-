// /v/<code>/calendar: the visit as a calendar file (Apple Calendar, Outlook).
import { buildCalendar, zonedToUtc } from "@/lib/ics";
import { loadVisitForManage, manageUrl } from "@/lib/manageLink";
import { publicSiteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { token } = await params;
  const v = await loadVisitForManage(token);
  if (!v || !v.confirmed) return new Response("Not found", { status: 404 });
  const s = v.stylist;
  const link = manageUrl(publicSiteUrl("https://www.clientelesuite.com"), token);
  const ics = buildCalendar({
    name: s.business_name,
    events: [
      {
        uid: `visit-${v.id}@clientelesuite.com`,
        start: zonedToUtc(v.booking_date, v.start_time, s.timezone),
        end: zonedToUtc(v.booking_date, v.end_time, s.timezone),
        title: `${v.service_name} · ${s.business_name}`,
        description: `Your ${v.service_name} with ${s.business_name}. Manage it: ${link}`,
        url: link,
        ...(v.location ? { location: v.location } : {}),
      },
    ],
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${s.business_name.replace(/[^A-Za-z0-9]+/g, "-")}-${v.words.appointment}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}

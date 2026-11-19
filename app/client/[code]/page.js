// /client/<pro ID>: the signed-in client's home with one pro. Not signed in
// (or not this pro's client): back to sign-in.
import { redirect } from "next/navigation";
import { createBookingClient } from "@/lib/supabase/booking";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayInTimeZone, timeZoneLabel } from "@/lib/availability";
import ClientHome from "./ClientHome";
import { zonedToUtc } from "@/lib/ics";

const clean = (code) => {
  const x = String(code || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^CL/, "");
  return /^[2-9A-HJKMNP-Z]{4}$/.test(x) ? `CL-${x}` : null;
};

export async function generateMetadata() {
  return { title: "Your visits · Clientele", robots: { index: false } };
}

export default async function ClientHomePage({ params }) {
  const { code: raw } = await params;
  const code = clean(raw);
  if (!code) redirect("/client");
  const supabase = await createBookingClient();
  const { data: home } = await supabase.rpc("client_home", { p_code: code });
  if (!home) redirect(`/client?code=${code}`);
  if (raw !== code) redirect(`/client/${code}`);

  const { data: upcoming } = await supabase.rpc("get_my_bookings", { p_slug: home.slug });

  // The style photo: a short-lived link, made only after the check above.
  let lookPhoto = null;
  if (home.look?.photo_path) {
    const { data } = await createAdminClient().storage.from("client-looks").createSignedUrl(home.look.photo_path, 60 * 60);
    lookPhoto = data?.signedUrl || null;
  }

  // "Add to Google Calendar" links, worked out here in the pro's time zone.
  const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const google = Object.fromEntries(
    (upcoming || []).map((b) => {
      const start = zonedToUtc(b.booking_date, b.start_time, home.timezone);
      const end = zonedToUtc(b.booking_date, b.end_time, home.timezone);
      const q = new URLSearchParams({
        action: "TEMPLATE",
        text: `${b.service_name} · ${home.business_name}`,
        dates: `${stamp(start)}/${stamp(end)}`,
        details: `Your ${b.service_name} with ${home.business_name}.`,
      });
      return [b.id, `https://calendar.google.com/calendar/render?${q}`];
    })
  );

  return (
    <ClientHome
      google={google}
      code={code}
      home={home}
      upcoming={upcoming || []}
      today={todayInTimeZone(home.timezone)}
      zoneNote={`Times are in ${timeZoneLabel(home.timezone)} time.`}
      lookPhoto={lookPhoto}
    />
  );
}

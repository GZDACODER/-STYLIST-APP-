// The booking behind a "Cancel this visit" / "Pay your deposit" email link.
// Server code only. Returns null if the link doesn't match a booking here.
import { createAdminClient } from "@/lib/supabase/admin";

export async function loadVisitByToken(slug, token) {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
  try {
    const { data } = await createAdminClient()
      .from("bookings")
      .select(
        "id, status, service_name, booking_date, start_time, end_time, price_cents, deposit_cents, deposit_status, cancellation_policy, standing_series_id, stylist:stylists(slug, business_name, timezone)"
      )
      .eq("cancel_token", token)
      .maybeSingle();
    if (!data || data.stylist?.slug !== String(slug).toLowerCase()) return null;

    // Has it started yet? (Compared in the stylist's time zone.)
    const nowLocal = new Intl.DateTimeFormat("sv-SE", {
      timeZone: data.stylist.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .format(new Date())
      .replace(" ", "T");
    const startsLocal = `${data.booking_date}T${data.start_time.slice(0, 5)}`;
    return { ...data, upcoming: startsLocal > nowLocal };
  } catch (error) {
    console.error("Couldn't load the visit for an email link", error);
    return null;
  }
}

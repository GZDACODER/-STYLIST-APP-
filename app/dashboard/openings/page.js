import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { timeZoneLabel, todayInTimeZone } from "@/lib/availability";
import BookingLink from "./BookingLink";
import PostOpeningsForm from "./PostOpeningsForm";
import OpeningsList from "./OpeningsList";

export const metadata = { title: "Openings · Regulars First" };

export default async function OpeningsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stylist } = await supabase
    .from("stylists")
    .select("slug, timezone")
    .eq("id", user.id)
    .maybeSingle();
  if (!stylist) redirect("/dashboard");

  const today = todayInTimeZone(stylist.timezone);

  const [{ data: openings, error }, { data: bookings }, { data: hourRows }] = await Promise.all([
    supabase
      .from("openings")
      .select("id, opening_date, start_time, end_time, visibility")
      .gte("opening_date", today)
      .order("opening_date")
      .order("start_time"),
    supabase
      .from("bookings")
      .select("booking_date, start_time")
      .eq("status", "confirmed")
      .gte("booking_date", today),
    supabase.from("working_hours").select("weekday, is_working"),
  ]);

  if (error) {
    return <p className="message error">Couldn't load your openings: {error.message}</p>;
  }

  // How many bookings fall inside each opening.
  const bookingCounts = {};
  for (const b of bookings || []) {
    const o = openings.find(
      (o) =>
        o.opening_date === b.booking_date &&
        o.start_time <= b.start_time &&
        o.end_time > b.start_time
    );
    if (o) bookingCounts[o.id] = (bookingCounts[o.id] || 0) + 1;
  }

  // Weekdays marked as days off on the Availability tab.
  const daysOff = (hourRows || []).filter((row) => !row.is_working).map((row) => row.weekday);

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  return (
    <>
      <section className="card">
        <h2>Your booking link</h2>
        <p className="muted">Share this with clients. No app or account needed.</p>
        <BookingLink link={`${origin}/book/${stylist.slug}`} />
      </section>

      <section className="card">
        <h2>Open times for booking</h2>
        <p className="muted">
          Clients can only book times you open here. &quot;Regulars only&quot; times are hidden from
          everyone except verified regulars.
        </p>
        <PostOpeningsForm today={today} daysOff={daysOff} />
      </section>

      <section className="card">
        <h2>Upcoming openings</h2>
        <p className="muted small-text">Times are in {timeZoneLabel(stylist.timezone)} time.</p>
        <OpeningsList openings={openings} bookingCounts={bookingCounts} />
      </section>
    </>
  );
}

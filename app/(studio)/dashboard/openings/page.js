import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clockTime, formatDate, timeZoneLabel, todayInTimeZone } from "@/lib/availability";
import SubmitButton from "@/components/SubmitButton";
import { openHoldToEveryone } from "./actions";
import BookingLink from "./BookingLink";
import { publicSiteUrl } from "@/lib/siteUrl";
import PostOpeningsForm from "./PostOpeningsForm";
import OpeningsList from "./OpeningsList";
import PausedNote from "@/components/PausedNote";
import { getMyPlan } from "@/lib/plan";
import { BRAND_NAME } from "@/lib/brand";
import RegularStar from "@/components/RegularStar";

export const metadata = { title: `Openings · ${BRAND_NAME}` };

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
  const plan = await getMyPlan(supabase, user.id);

  const [{ data: openings, error }, { data: bookings }, { data: hourRows }, { data: holdRows }] =
    await Promise.all([
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
      supabase
        .from("regulars_holds")
        .select("id, hold_date, start_time, end_time")
        .gte("hold_date", today)
        .order("hold_date")
        .order("start_time"),
    ]);
  // Only holds inside an "Everyone" opening matter ("Regulars only" openings
  // are for Regulars anyway).
  const holds = (holdRows || []).filter((h) =>
    (openings || []).some(
      (o) =>
        o.visibility === "everyone" &&
        o.opening_date === h.hold_date &&
        o.start_time < h.end_time &&
        o.end_time > h.start_time
    )
  );

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
  // The booking link uses the app's public address (NEXT_PUBLIC_SITE_URL in
  // Vercel), so it's the same wherever you open the dashboard. Until that's
  // set, it uses this page's address.
  const origin = publicSiteUrl(`${proto}://${host}`);

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
        {!plan.has.regulars && (
          <PausedNote feature="regulars">
            Regulars First isn&apos;t on your plan right now, so new openings are for everyone.
          </PausedNote>
        )}
        <PostOpeningsForm today={today} daysOff={daysOff} regularsAllowed={plan.has.regulars} />
      </section>

      {holds.length > 0 && (
        <section className="card">
          <h2>
            <RegularStar label={null} size={14} /> Kept for Regulars
          </h2>
          <p className="muted">
            Regulars bookings that were cancelled. These times stay Regulars only, and only
            waitlisted Regulars hear about them, until they&apos;re booked again or you open them to
            everyone.
          </p>
          <ul className="service-list">
            {holds.map((h) => (
              <li key={h.id}>
                <div>
                  <div className="service-name">{formatDate(h.hold_date)}</div>
                  <div className="muted">
                    {clockTime(h.start_time)} – {clockTime(h.end_time)}
                  </div>
                </div>
                <form action={openHoldToEveryone}>
                  <input type="hidden" name="id" value={h.id} />
                  <SubmitButton className="button secondary small" pendingText="Opening...">
                    Open to everyone
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Upcoming openings</h2>
        <p className="muted small-text">Times are in {timeZoneLabel(stylist.timezone)} time.</p>
        <OpeningsList
          openings={openings}
          bookingCounts={bookingCounts}
          regularsAllowed={plan.has.regulars}
        />
      </section>
    </>
  );
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clockTime, formatDate, timeZoneLabel, todayInTimeZone } from "@/lib/availability";
import SubmitButton from "@/components/SubmitButton";
import { openHoldToEveryone } from "./actions";
import PageHeader from "@/components/dash/PageHeader";
import CopyLinkButton from "@/components/dash/CopyLinkButton";
import { exampleData, examplesOn } from "@/lib/examples";
import { ExampleTag } from "@/components/dash/Example";
import Link from "next/link";
import { publicSiteUrl } from "@/lib/siteUrl";
import PostOpeningsForm from "./PostOpeningsForm";
import OpeningsList from "./OpeningsList";
import PausedNote from "@/components/PausedNote";
import { getMyPlan } from "@/lib/plan";
import { BRAND_NAME } from "@/lib/brand";
import RegularStar from "@/components/RegularStar";
import { eventsOn } from "@/lib/calendarEvents";
import { holidaysOn } from "@/lib/holidays";
import { getMyTemplate } from "@/lib/templates/server";

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

  // What blocks bookings inside each opening: "Block bookings" events and
  // closed holidays (both empty before the step 29 / 34 SQL is run).
  const [{ data: eventRows }, { data: holidayRows }, { data: closedDateRows }] = await Promise.all([
    supabase.from("calendar_events").select("*").eq("blocks_bookings", true).limit(2000),
    supabase.from("stylist_holiday_settings").select("holiday_key").eq("closed", true),
    // Holidays closed for one date only ("Closed this holiday" on the Calendar).
    supabase.from("blocked_dates").select("blocked_on, reason").gte("blocked_on", today).like("reason", "Closed – %"),
  ]);
  const closedDates = new Map((closedDateRows || []).map((r) => [r.blocked_on, r.reason]));
  const closedKeys = new Set((holidayRows || []).map((r) => r.holiday_key));
  const hhmm = (t) => String(t).slice(0, 5);
  // "4–5 PM", "9:30 AM–12 PM": short enough for one row.
  const short = (t) => clockTime(t).replace(":00", "");
  const compactRange = (a, b) => {
    const [from, to] = [short(a), short(b)];
    const [fromNum, fromHalf] = from.split(" ");
    return fromHalf === to.split(" ")[1] ? `${fromNum}–${to}` : `${from}–${to}`;
  };
  // blockedBy: { openingId: [{ short: "4–5 PM blocked", full: "Maya's practice: ..." }] }
  const blockedBy = {};
  for (const o of openings || []) {
    const notes = [];
    const closed = holidaysOn(o.opening_date).find((h) => h.key && closedKeys.has(h.key));
    if (closed) notes.push({ short: `Closed – ${closed.name}`, full: `Closed for ${closed.name}: none of this can be booked` });
    else if (closedDates.has(o.opening_date)) {
      const reason = closedDates.get(o.opening_date);
      notes.push({ short: reason, full: `${reason}: none of this can be booked` });
    }
    for (const e of eventsOn(eventRows || [], o.opening_date)) {
      if (!e.start_time) notes.push({ short: "All day blocked", full: `${e.title} (all day): none of this can be booked` });
      else if (hhmm(e.start_time) < hhmm(o.end_time) && hhmm(e.end_time) > hhmm(o.start_time)) {
        notes.push({
          short: `${compactRange(e.start_time, e.end_time)} blocked`,
          full: `${e.title}: ${clockTime(e.start_time)} – ${clockTime(e.end_time)} can't be booked`,
        });
      }
    }
    if (notes.length) blockedBy[o.id] = notes;
  }

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

  // Examples for a new pro (only while they have no openings of their own).
  const examples = !(openings || []).length && (await examplesOn(supabase, user.id)) ? exampleData(today, await getMyTemplate()) : null;

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
      <PageHeader guide="openings"
        title="Openings"
        subtitle={
          <>
            Times are in {timeZoneLabel(stylist.timezone)} time. Your booking link:{" "}
            <a href={`${origin}/book/${stylist.slug}`} target="_blank" rel="noreferrer">
              {`${origin.replace(/^https?:\/\//, "")}/book/${stylist.slug}`}
            </a>{" "}
            · <Link href="/dashboard/settings/booking-page">change it</Link>
          </>
        }
        actions={
          <>
            <CopyLinkButton link={`${origin}/book/${stylist.slug}`} />
            <a href="#add-opening" className="button small">
              + Add opening
            </a>
          </>
        }
      />

      <section className="card">
        <OpeningsList
          openings={openings}
          bookingCounts={bookingCounts}
          blockedBy={blockedBy}
          regularsAllowed={plan.has.regulars}
          today={today}
          examples={examples?.openings || []}
        />
      </section>

      <section className="card" id="add-opening">
        <h2>Open times for booking</h2>
        <p className="muted">
          Clients can only book times you open here. &quot;Regulars only&quot; times are hidden from
          everyone except verified regulars.
        </p>
        {!plan.has.regulars && (
          <PausedNote feature="regulars">
            Your plan is paused, so new openings are for everyone.
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

      {holds.length === 0 && examples && (
        <section className="card is-example">
          <h2>
            <RegularStar label={null} size={14} /> Kept for Regulars <ExampleTag />
          </h2>
          <p className="muted">
            Example: when a Regular cancels, their time stays Regulars only (and only waitlisted Regulars hear
            about it) until it&apos;s booked again or you open it to everyone.
          </p>
          <ul className="service-list">
            {examples.holds.map((h) => (
              <li key={h.id}>
                <div>
                  <div className="service-name">{formatDate(h.hold_date)}</div>
                  <div className="muted">
                    {clockTime(h.start_time)} – {clockTime(h.end_time)} · Maya Jones cancelled
                  </div>
                </div>
                <span className="badge regular">Regulars only</span>
              </li>
            ))}
          </ul>
        </section>
      )}

    </>
  );
}

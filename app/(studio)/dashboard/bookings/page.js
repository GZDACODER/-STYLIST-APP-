import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { clockTime, formatDate, hoursByWeekday, timeZoneLabel, todayInTimeZone } from "@/lib/availability";
import { nowLocal } from "@/lib/localTime";
import { BRAND_NAME } from "@/lib/brand";
import CalendarView from "./CalendarView";
import PageHeader from "@/components/dash/PageHeader";
import Collapsible from "@/components/dash/Collapsible";
import RowList from "@/components/dash/RowList";
import { CancelledDepositBadge } from "./badges";
import RefundDepositButton from "./RefundDepositButton";
import { formatPrice } from "@/lib/money";

export const metadata = { title: `Calendar · ${BRAND_NAME}` };

function daysBefore(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

export default async function BookingsPage({ searchParams }) {
  const { add } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stylist } = await supabase
    .from("stylists")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  if (!stylist) redirect("/dashboard");

  const today = todayInTimeZone(stylist.timezone);

  // Clients who've had enough appointments become Regulars (see Settings).
  await supabase.rpc("refresh_my_regulars");

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(
      "id, booking_date, start_time, end_time, service_name, price_cents, client_name, client_email, client_phone, status, deposit_cents, deposit_status, hold_expires_at, client:clients(status, invited_at)"
    )
    .gte("booking_date", today)
    .order("booking_date")
    .order("start_time");

  if (error) {
    return <p className="message error">Couldn&apos;t load your bookings: {error.message}</p>;
  }

  // Which bookings are standing visits (read on its own, so the Calendar
  // still opens before the step 16 SQL is run).
  const { data: standingRows } = await supabase
    .from("bookings")
    .select("id, standing_series_id")
    .gte("booking_date", today)
    .not("standing_series_id", "is", null);
  const seriesOf = new Map((standingRows || []).map((r) => [r.id, r.standing_series_id]));

  // Bookings a client moved themselves (empty until the step 25 SQL is run):
  // "Rescheduled by client" and the original time, in the business's time zone.
  const { data: movedRows } = await supabase
    .from("bookings")
    .select("id, reschedule_count, original_start_at")
    .gte("booking_date", daysBefore(today, 366))
    .gt("reschedule_count", 0);
  const movedText = new Map(
    (movedRows || []).map((r) => {
      const when = r.original_start_at
        ? new Date(r.original_start_at).toLocaleString("en-US", {
            timeZone: stylist.timezone,
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : null;
      return [r.id, { count: r.reschedule_count, originally: when }];
    })
  );

  const upcoming = bookings.filter((b) => b.status === "confirmed");
  const cancelled = bookings.filter((b) => b.status === "cancelled");
  // Clients on Stripe's payment page right now. Their time is held until then.
  const now = Date.now();
  const awaitingPayment = bookings.filter(
    (b) => b.status === "pending_payment" && new Date(b.hold_expires_at).getTime() > now
  );
  const holdUntil = (b) =>
    new Date(b.hold_expires_at).toLocaleTimeString("en-US", {
      timeZone: stylist.timezone,
      hour: "numeric",
      minute: "2-digit",
    });

  // For the month calendar: confirmed visits from the last 12 months, with
  // how they went and their note (each read on its own, so the Calendar still
  // opens before the step 18 and 24 SQL is run).
  const PAST_COLUMNS =
    "id, booking_date, start_time, end_time, service_name, price_cents, client_name, client_email, client_phone, status, deposit_cents, deposit_status, client:clients(status, invited_at)";
  const loadPast = (cols) =>
    supabase
      .from("bookings")
      .select(cols)
      .eq("status", "confirmed")
      .gte("booking_date", daysBefore(today, 366))
      .lt("booking_date", today)
      .order("booking_date")
      .order("start_time")
      .limit(3000);
  let { data: pastRows, error: pastError } = await loadPast(`${PAST_COLUMNS}, outcome, visit_note, owed_cents`);
  if (pastError) ({ data: pastRows, error: pastError } = await loadPast(`${PAST_COLUMNS}, outcome`));
  if (pastError) ({ data: pastRows } = await loadPast(PAST_COLUMNS));

  // Today's visits that have started count as past too (no Cancel).
  const { data: todayRows } = await supabase
    .from("bookings")
    .select("id, outcome, visit_note, owed_cents")
    .eq("booking_date", today)
    .eq("status", "confirmed");
  const todayExtra = new Map((todayRows || []).map((r) => [r.id, r]));

  const [{ data: hourRows }, { data: blockedRows }] = await Promise.all([
    supabase.from("working_hours").select("weekday, is_working, start_time, end_time"),
    supabase.from("blocked_dates").select("blocked_on, reason").gte("blocked_on", daysBefore(today, 400)),
  ]);
  const blocked = Object.fromEntries((blockedRows || []).map((r) => [r.blocked_on, r.reason || ""]));

  // The stylist's own events (null until the step 29 SQL is run; colours and
  // repeat days from step 34).
  const EVENT_COLUMNS = "id, title, starts_on, start_time, end_time, repeats, repeat_until, skipped_dates, blocks_bookings, note";
  const loadEvents = (cols) => supabase.from("calendar_events").select(cols).order("starts_on").limit(2000);
  let { data: eventRows, error: eventsError } = await loadEvents(`${EVENT_COLUMNS}, color, repeat_days, monthly_mode`);
  if (eventsError) ({ data: eventRows, error: eventsError } = await loadEvents(EVENT_COLUMNS));
  const events = eventsError ? null : eventRows || [];
  // Federal holidays the business closes on (empty before step 34).
  const { data: holidayRows } = await supabase.from("stylist_holiday_settings").select("holiday_key").eq("closed", true);
  const closedHolidays = (holidayRows || []).map((r) => r.holiday_key);

  const nowText = nowLocal(stylist.timezone);
  const startedAt = (b) => `${b.booking_date}T${String(b.start_time).slice(0, 5)}`;
  for (const b of upcoming) {
    if (b.booking_date === today && startedAt(b) <= nowText) {
      Object.assign(b, todayExtra.get(b.id) || {}, { past: true });
    }
  }
  for (const b of upcoming) if (movedText.has(b.id)) b.moved = movedText.get(b.id);

  // Intake form on file for upcoming bookings of services that need it
  // (empty until the step 28 SQL is run).
  if (upcoming.length) {
    const { data: intakeRows } = await supabase.rpc("bookings_intake", {
      p_booking_ids: upcoming.map((b) => b.id),
    });
    const intakeOf = new Map((intakeRows || []).filter((r) => r.needed).map((r) => [r.booking_id, r.on_file]));
    for (const b of upcoming) if (intakeOf.has(b.id)) b.intake = { onFile: intakeOf.get(b.id) };
  }
  const calendarBookings = [
    ...(pastRows || []).map((b) => ({ ...b, past: true, moved: movedText.get(b.id) })),
    ...upcoming,
  ];

  // Group by date.
  const days = [];
  for (const b of upcoming) {
    const last = days[days.length - 1];
    if (last && last.date === b.booking_date) last.bookings.push(b);
    else days.push({ date: b.booking_date, bookings: [b] });
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle={
          <>
            Times are in {timeZoneLabel(stylist.timezone)} time. ·{" "}
            <Link href="/dashboard/availability">Working hours &amp; days off</Link>
          </>
        }
        actions={
          <>
            <Link href="/dashboard/openings" className="button secondary small">
              + Add opening
            </Link>
            {events && (
              <Link href="/dashboard/bookings?add=event" className="button small">
                + Add event
              </Link>
            )}
          </>
        }
      />
      <section className="card">

        {upcoming.length === 0 && (pastRows || []).length === 0 && (
          <p className="muted">
            No bookings yet. <Link href="/dashboard/openings">Open some times</Link> and share
            your booking link.
          </p>
        )}

        <CalendarView
          bookings={calendarBookings}
          days={days}
          seriesOf={Object.fromEntries(seriesOf)}
          today={today}
          hours={hoursByWeekday(hourRows)}
          blocked={blocked}
          events={events}
          closedHolidays={closedHolidays}
          openAdd={add === "event"}
          key={add === "event" ? "add" : "cal"}
        />
      </section>

      {awaitingPayment.length > 0 && (
        <section className="card">
          <h2>Waiting for deposit</h2>
          <p className="muted small-text">
            These clients are paying their deposit now. If they don&apos;t pay by the time shown,
            the time opens up again.
          </p>
          <RowList
            label="Calendar"
            items={awaitingPayment.map((b) => ({
              key: b.id,
              title: b.client_name,
              sub: `${formatDate(b.booking_date)} · ${clockTime(b.start_time)} · ${b.service_name}`,
              badge: <span className="badge unpaid row-badge">Unpaid</span>,
              panel: (
                <p className="muted">
                  {formatPrice(b.deposit_cents)} deposit · held until {holdUntil(b)}. If they don&apos;t pay by then,
                  the time opens up again.
                </p>
              ),
            }))}
          />
        </section>
      )}

      {cancelled.length > 0 && (
        <Collapsible title="Cancelled" count={cancelled.length}>
          <RowList
            label="Calendar"
            noun="more cancelled"
            items={cancelled.map((b) => ({
              key: b.id,
              title: b.client_name,
              sub: `${formatDate(b.booking_date)} · ${clockTime(b.start_time)} · ${b.service_name}`,
              badge: <CancelledDepositBadge booking={b} />,
              panel: (
                <>
                  <dl className="booking-facts">
                    <div>
                      <dt>Was booked for</dt>
                      <dd>
                        {formatDate(b.booking_date)} at {clockTime(b.start_time)}
                      </dd>
                    </div>
                    <div>
                      <dt>Service</dt>
                      <dd>{b.service_name}</dd>
                    </div>
                  </dl>
                  {b.deposit_status === "paid" && b.deposit_cents > 0 && (
                    <div className="refund-row">
                      <RefundDepositButton id={b.id} clientName={b.client_name} depositCents={b.deposit_cents} />
                    </div>
                  )}
                </>
              ),
            }))}
          />
        </Collapsible>
      )}
    </>
  );
}

import { exampleData, examplesOn } from "@/lib/examples";
import { ExampleCard, ExampleTag } from "@/components/dash/Example";
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
import { calendarWindowStart, loadPastBookings, movedText } from "@/lib/calendarPast";

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

  // The time zone, and (at the same time) clients who've had enough
  // appointments become Regulars (see Settings).
  const [{ data: stylist }] = await Promise.all([
    supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle(),
    supabase.rpc("refresh_my_regulars"),
  ]);
  if (!stylist) redirect("/dashboard");

  const today = todayInTimeZone(stylist.timezone);

  // Everything below is read at the same time: each query starts now and is
  // awaited where it's used. (Supabase queries only run once awaited, so
  // start() kicks them off.)
  const start = (query) => Promise.resolve(query);
  // Past visits: only this month and last month now. Older months load when
  // the pro goes back to them (CalendarView), so a busy book stays quick.
  const windowStart = calendarWindowStart(today);
  const EVENT_COLUMNS = "id, title, starts_on, start_time, end_time, repeats, repeat_until, skipped_dates, blocks_bookings, note";
  const loadEvents = (cols) => supabase.from("calendar_events").select(cols).order("starts_on").limit(2000);
  const pending = {
    standing: start(supabase.from("bookings").select("id, standing_series_id").gte("booking_date", today).not("standing_series_id", "is", null)),
    moved: start(
      supabase
        .from("bookings")
        .select("id, reschedule_count, original_start_at")
        .gte("booking_date", today)
        .gt("reschedule_count", 0)
    ),
    past: loadPastBookings(supabase, windowStart, today, stylist.timezone),
    // Any visits before that (for the Calendar's back arrow and examples).
    older: start(
      supabase.from("bookings").select("id").eq("status", "confirmed").lt("booking_date", windowStart).limit(1)
    ),
    today: start(supabase.from("bookings").select("id, outcome, visit_note, owed_cents").eq("booking_date", today).eq("status", "confirmed")),
    hours: start(supabase.from("working_hours").select("weekday, is_working, start_time, end_time")),
    blocked: start(supabase.from("blocked_dates").select("blocked_on, reason").gte("blocked_on", daysBefore(today, 400))),
    events: start(loadEvents(`${EVENT_COLUMNS}, color, repeat_days, monthly_mode`)),
    holidays: start(supabase.from("stylist_holiday_settings").select("holiday_key").eq("closed", true)),
    examples: examplesOn(supabase, user.id),
  };

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
  const { data: standingRows } = await pending.standing;
  const seriesOf = new Map((standingRows || []).map((r) => [r.id, r.standing_series_id]));

  // Bookings a client moved themselves (empty until the step 25 SQL is run):
  // "Rescheduled by client" and the original time, in the business's time zone.
  const { data: movedRows } = await pending.moved;
  const moved = movedText(movedRows, stylist.timezone);

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

  // For the month calendar: confirmed visits since the start of last month,
  // with how they went and their note.
  const pastRows = await pending.past;
  const { data: olderRows } = await pending.older;
  const hasOlder = (olderRows || []).length > 0;

  // Today's visits that have started count as past too (no Cancel).
  const { data: todayRows } = await pending.today;
  const todayExtra = new Map((todayRows || []).map((r) => [r.id, r]));

  const [{ data: hourRows }, { data: blockedRows }] = await Promise.all([pending.hours, pending.blocked]);
  const blocked = Object.fromEntries((blockedRows || []).map((r) => [r.blocked_on, r.reason || ""]));

  // The stylist's own events (null until the step 29 SQL is run; colours and
  // repeat days from step 34).
  let { data: eventRows, error: eventsError } = await pending.events;
  if (eventsError) ({ data: eventRows, error: eventsError } = await loadEvents(EVENT_COLUMNS));
  const events = eventsError ? null : eventRows || [];
  // Federal holidays the business closes on (empty before step 34).
  const { data: holidayRows } = await pending.holidays;
  const closedHolidays = (holidayRows || []).map((r) => r.holiday_key);

  const nowText = nowLocal(stylist.timezone);
  const startedAt = (b) => `${b.booking_date}T${String(b.start_time).slice(0, 5)}`;
  for (const b of upcoming) {
    if (b.booking_date === today && startedAt(b) <= nowText) {
      Object.assign(b, todayExtra.get(b.id) || {}, { past: true });
    }
  }
  for (const b of upcoming) if (moved.has(b.id)) b.moved = moved.get(b.id);

  // Intake form on file for upcoming bookings of services that need it
  // (empty until the step 28 SQL is run).
  if (upcoming.length) {
    const { data: intakeRows } = await supabase.rpc("bookings_intake", {
      p_booking_ids: upcoming.map((b) => b.id),
    });
    const intakeOf = new Map((intakeRows || []).filter((r) => r.needed).map((r) => [r.booking_id, r.on_file]));
    for (const b of upcoming) if (intakeOf.has(b.id)) b.intake = { onFile: intakeOf.get(b.id) };
  }
  // Examples for a new pro: bookings while they have none (past or
  // upcoming), events while they have none, cancelled while none.
  const showExamples = await pending.examples;
  const ex = showExamples ? exampleData(today) : null;
  const exampleBookings = ex && upcoming.length === 0 && cancelled.length === 0 && pastRows.length === 0 && !hasOlder;
  if (ex && events && events.length === 0) events.push(...ex.events);
  const calendarBookings = exampleBookings ? [...ex.past.map((b) => ({ ...b, past: true })), ...ex.upcoming] : [...pastRows, ...upcoming];

  // Group by date.
  const days = [];
  for (const b of exampleBookings ? ex.upcoming : upcoming) {
    const last = days[days.length - 1];
    if (last && last.date === b.booking_date) last.bookings.push(b);
    else days.push({ date: b.booking_date, bookings: [b] });
  }

  return (
    <>
      <PageHeader guide="calendar"
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

        {exampleBookings && (
          <p className="examples-note">
            These are example bookings and events. They go away once you have real ones.
          </p>
        )}
        {upcoming.length === 0 && pastRows.length === 0 && !hasOlder && !exampleBookings && (
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
          loadedFrom={exampleBookings ? null : windowStart}
          hasOlder={!exampleBookings && hasOlder}
          timeZone={stylist.timezone}
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

      {cancelled.length === 0 && exampleBookings && (
        <Collapsible title="Cancelled" count={ex.cancelled.length}>
          <RowList
            label="Calendar"
            items={ex.cancelled.map((b) => ({
              key: b.id,
              example: true,
              title: b.client_name,
              sub: `${formatDate(b.booking_date)} · ${clockTime(b.start_time)} · ${b.service_name}`,
              badge: <ExampleTag />,
              fullPanel: (
                <ExampleCard
                  title={b.client_name}
                  facts={[
                    ["Was booked for", `${formatDate(b.booking_date)} at ${clockTime(b.start_time)}`],
                    ["Service", b.service_name],
                    ["What happened", b.label],
                    [
                      "Deposit",
                      b.late
                        ? `${formatPrice(b.deposit_cents)} kept (cancelled inside your policy window)`
                        : "None",
                    ],
                  ]}
                />
              ),
            }))}
          />
        </Collapsible>
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

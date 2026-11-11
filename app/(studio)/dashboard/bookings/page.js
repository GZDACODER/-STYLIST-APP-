import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { clockTime, formatDate, hoursByWeekday, timeZoneLabel, todayInTimeZone } from "@/lib/availability";
import { nowLocal } from "@/lib/localTime";
import { BRAND_NAME } from "@/lib/brand";
import CalendarView from "./CalendarView";
import { CancelledDepositBadge } from "./badges";
import { formatPrice } from "@/lib/money";

export const metadata = { title: `Calendar · ${BRAND_NAME}` };

function daysBefore(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

export default async function BookingsPage() {
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

  const nowText = nowLocal(stylist.timezone);
  const startedAt = (b) => `${b.booking_date}T${String(b.start_time).slice(0, 5)}`;
  for (const b of upcoming) {
    if (b.booking_date === today && startedAt(b) <= nowText) {
      Object.assign(b, todayExtra.get(b.id) || {}, { past: true });
    }
  }
  const calendarBookings = [...(pastRows || []).map((b) => ({ ...b, past: true })), ...upcoming];

  // Group by date.
  const days = [];
  for (const b of upcoming) {
    const last = days[days.length - 1];
    if (last && last.date === b.booking_date) last.bookings.push(b);
    else days.push({ date: b.booking_date, bookings: [b] });
  }

  return (
    <>
      <section className="card">
        <h2>Calendar</h2>
        <p className="muted small-text">
          Times are in {timeZoneLabel(stylist.timezone)} time. ·{" "}
          <Link href="/dashboard/availability">Working hours &amp; days off</Link>
        </p>

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
        />
      </section>

      {awaitingPayment.length > 0 && (
        <section className="card">
          <h2>Waiting for deposit</h2>
          <p className="muted small-text">
            These clients are paying their deposit now. If they don&apos;t pay by the time shown,
            the time opens up again.
          </p>
          <ul className="service-list">
            {awaitingPayment.map((b) => (
              <li key={b.id}>
                <div>
                  <div className="service-name">{b.client_name}</div>
                  <div className="muted">
                    {formatDate(b.booking_date)} · {clockTime(b.start_time)} · {b.service_name}
                  </div>
                  <div className="muted small-text">
                    {formatPrice(b.deposit_cents)} deposit · held until {holdUntil(b)}
                  </div>
                </div>
                <span className="badge unpaid">Unpaid</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {cancelled.length > 0 && (
        <section className="card">
          <h2>Cancelled</h2>
          <ul className="service-list">
            {cancelled.map((b) => (
              <li key={b.id}>
                <div>
                  <div className="service-name">{b.client_name}</div>
                  <div className="muted">
                    {formatDate(b.booking_date)} · {clockTime(b.start_time)} · {b.service_name}
                  </div>
                  {b.deposit_status === "paid" && (
                    <div className="muted small-text">
                      {formatPrice(b.deposit_cents)} deposit was paid. To refund it, use Open
                      Stripe on the Settings tab.
                    </div>
                  )}
                </div>
                <CancelledDepositBadge booking={b} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

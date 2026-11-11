import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { clockTime, formatDate, timeZoneLabel, todayInTimeZone } from "@/lib/availability";
import { BRAND_NAME } from "@/lib/brand";
import BookingList from "./BookingList";
import { CancelledDepositBadge } from "./badges";
import { formatPrice } from "@/lib/money";

export const metadata = { title: `Bookings · ${BRAND_NAME}` };

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
        <h2>Upcoming bookings</h2>
        <p className="muted small-text">
          Times are in {timeZoneLabel(stylist.timezone)} time. ·{" "}
          <Link href="/dashboard/availability">Working hours &amp; days off</Link>
        </p>

        {upcoming.length === 0 && (
          <p className="muted">
            No bookings yet. <Link href="/dashboard/openings">Open some times</Link> and share
            your booking link.
          </p>
        )}

        <BookingList days={days} seriesOf={Object.fromEntries(seriesOf)} today={today} />
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

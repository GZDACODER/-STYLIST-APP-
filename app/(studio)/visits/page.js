// Wrap up visits from the email's link, without logging in. The link's
// pass covers one business and a few dates, for 7 days (lib/visitPass.js).
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { readVisitPass } from "@/lib/visitPass";
import { clockTime, formatDate } from "@/lib/availability";
import { formatPrice } from "@/lib/money";
import { nowLocal } from "@/lib/localTime";
import { BRAND_NAME } from "@/lib/brand";
import OutcomePicker from "../dashboard/wrapup/OutcomePicker";

export const metadata = { title: `Wrap up visits · ${BRAND_NAME}`, robots: { index: false } };

function deposit(b) {
  if (!b.deposit_cents) return "";
  if (b.deposit_status === "paid") return ` · ${formatPrice(b.deposit_cents)} deposit paid`;
  if (b.deposit_status === "unpaid") return ` · ${formatPrice(b.deposit_cents)} deposit unpaid`;
  return "";
}

export default async function VisitsPage({ searchParams }) {
  const { p: pass } = await searchParams;
  const access = readVisitPass(pass);

  if (!access) {
    return (
      <section className="card">
        <h2>This link has expired</h2>
        <p className="muted">
          Wrap-up links work for 7 days. Log in and open Wrap up visits from your dashboard.
        </p>
        <Link href="/dashboard/wrapup" className="button">
          Log in to wrap up
        </Link>
      </section>
    );
  }

  const admin = createAdminClient();
  const [{ data: stylist }, { data: rows }] = await Promise.all([
    admin.from("stylists").select("business_name, timezone").eq("id", access.stylistId).maybeSingle(),
    admin
      .from("bookings")
      .select("id, booking_date, start_time, end_time, client_name, service_name, price_cents, deposit_cents, deposit_status, outcome")
      .eq("stylist_id", access.stylistId)
      .eq("status", "confirmed")
      .gte("booking_date", access.from)
      .lte("booking_date", access.to)
      .order("booking_date", { ascending: false })
      .order("start_time"),
  ]);

  const now = nowLocal(stylist?.timezone || "America/Chicago");
  const visits = (rows || []).filter((b) => `${b.booking_date}T${b.start_time.slice(0, 5)}` <= now);
  const left = visits.filter((b) => !b.outcome).length;

  const days = [];
  for (const b of visits) {
    const last = days[days.length - 1];
    if (last && last.date === b.booking_date) last.visits.push(b);
    else days.push({ date: b.booking_date, visits: [b] });
  }

  return (
    <section className="card">
      <p className="db-label">{stylist?.business_name}</p>
      <h2>Wrap up visits</h2>
      <p className="muted small-text">
        {visits.length === 0
          ? "No visits to wrap up."
          : left === 0
            ? "All marked. Thank you!"
            : `${left === 1 ? "1 visit" : `${left} visits`} left to mark.`}{" "}
        Tap a choice to save it straight away. Nothing is charged or refunded automatically.
      </p>

      <ul className="day-list">
        {days.map((day) => (
          <li key={day.date} className="day-group">
            <div className="day-heading">
              <strong>{formatDate(day.date)}</strong>
            </div>
            <ul className="client-list">
              {day.visits.map((b) => (
                <li key={b.id} className="client-card wrapup-visit">
                  <div className="client-top">
                    <span className="opening-time">
                      {clockTime(b.start_time)} – {clockTime(b.end_time)}
                    </span>
                  </div>
                  <div className="client-name">{b.client_name}</div>
                  <div className="muted small-text">
                    {b.service_name} · {formatPrice(b.price_cents)}
                    {deposit(b)}
                  </div>
                  <OutcomePicker bookingId={b.id} outcome={b.outcome} clientName={b.client_name} pass={pass} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>

      <p className="muted small-text">
        <Link href="/dashboard">Open your full dashboard</Link> (you may need to log in).
      </p>
    </section>
  );
}

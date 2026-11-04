import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  clockTime,
  parseDateString,
  timeZoneLabel,
  toDateString,
  todayInTimeZone,
} from "@/lib/availability";
import { formatPrice } from "@/lib/money";
import { BRAND_NAME } from "@/lib/brand";
import RegularStar from "@/components/RegularStar";

export const metadata = { title: `Today · ${BRAND_NAME}` };

// "Good morning" / "Good afternoon" / "Good evening", in the stylist's time zone.
function greeting(timeZone) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(
      new Date()
    )
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// "Good afternoon, Gabrielle" with the first name from Settings, or just
// "Good afternoon" when there isn't one.
function greetingLine(timeZone, firstName) {
  const name = String(firstName || "").trim();
  return name ? `${greeting(timeZone)}, ${name}` : greeting(timeZone);
}

// Monday to Sunday of the week that contains `today` ("YYYY-MM-DD").
function weekRange(today) {
  const day = parseDateString(today);
  const fromMonday = (day.getDay() + 6) % 7;
  const monday = new Date(day);
  monday.setDate(day.getDate() - fromMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toDateString(monday), end: toDateString(sunday) };
}

// Deposit amount and whether it's paid (same wording as the Calendar tab).
function DepositTag({ booking }) {
  const { deposit_cents: cents, deposit_status: status } = booking;
  if (status === "none" || !cents) return <span className="badge">No deposit</span>;
  if (status === "paid") return <span className="badge paid">{formatPrice(cents)} deposit paid</span>;
  if (status === "refunded" || status === "refund_pending") {
    return <span className="badge">{formatPrice(cents)} deposit refunded</span>;
  }
  return <span className="badge unpaid">{formatPrice(cents)} deposit unpaid</span>;
}

export default async function TodayPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stylist } = await supabase
    .from("stylists")
    .select("business_name, timezone")
    .eq("id", user.id)
    .maybeSingle();
  if (!stylist) return null;

  // Read on its own, so the dashboard still opens before the first name SQL (0015) is run.
  const { data: firstNameRow } = await supabase
    .from("stylists")
    .select("first_name")
    .eq("id", user.id)
    .maybeSingle();

  const tz = stylist.timezone;
  const today = todayInTimeZone(tz);
  const week = weekRange(today);
  // A little over a week back, then narrowed to this week in the stylist's time zone.
  const paidSince = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
  const nowTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());

  const stillToCome = `booking_date.gt.${today},and(booking_date.eq.${today},start_time.gt.${nowTime})`;

  const [weekBookings, paidDeposits, waiting, todays, upcoming, nextUp, weekOpenings] =
    await Promise.all([
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("booking_date", week.start)
      .lte("booking_date", week.end),
    supabase
      .from("bookings")
      .select("deposit_cents, deposit_paid_at")
      .eq("deposit_status", "paid")
      .gte("deposit_paid_at", paidSince),
    supabase
      .from("waitlist_entries")
      .select("id", { count: "exact", head: true })
      .eq("status", "waiting"),
    supabase
      .from("bookings")
      .select(
        "id, start_time, end_time, service_name, client_name, status, deposit_cents, deposit_status, hold_expires_at, client:clients(status)"
      )
      .eq("booking_date", today)
      .in("status", ["confirmed", "pending_payment"])
      .order("start_time"),
    // Every confirmed appointment still to come: later days, plus later today.
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed")
      .or(stillToCome),
    // Wide screens: the next appointment, and the open times left this week.
    supabase
      .from("bookings")
      .select("booking_date, start_time, end_time, service_name, client_name")
      .eq("status", "confirmed")
      .or(stillToCome)
      .order("booking_date")
      .order("start_time")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("openings")
      .select("id, opening_date, start_time, end_time, visibility")
      .gte("opening_date", today)
      .lte("opening_date", week.end)
      .order("opening_date")
      .order("start_time"),
  ]);
  // Today's openings that have already finished don't count.
  const openTimes = (weekOpenings.data || []).filter(
    (o) => o.opening_date > today || o.end_time.slice(0, 5) > nowTime
  );
  const shortDay = (date) =>
    parseDateString(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  const dayOf = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
  const depositsThisWeek = (paidDeposits.data || [])
    .filter((b) => {
      const day = dayOf(b.deposit_paid_at);
      return day >= week.start && day <= week.end;
    })
    .reduce((sum, b) => sum + (b.deposit_cents || 0), 0);

  // Confirmed ones, plus anyone paying their deposit right now.
  const now = Date.now();
  const appointments = (todays.data || []).filter(
    (b) => b.status === "confirmed" || new Date(b.hold_expires_at).getTime() > now
  );
  const dateLine = parseDateString(today).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const money = (cents) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: cents % 100 ? 2 : 0,
    }).format(cents / 100);

  const stats = [
    {
      number: weekBookings.error ? "—" : weekBookings.count ?? 0,
      // Confirmed appointments taking place Monday to Sunday this week.
      label: "Appointments this week",
      href: "/dashboard/bookings",
    },
    {
      number: paidDeposits.error ? "—" : money(depositsThisWeek),
      label: "Deposits paid this week",
      href: "/dashboard/bookings",
    },
    {
      number: waiting.error ? "—" : waiting.count ?? 0,
      label: "On the waitlist",
      href: "/dashboard/waitlist",
    },
    {
      number: upcoming.error ? "—" : upcoming.count ?? 0,
      label: "Upcoming",
      href: "/dashboard/bookings",
    },
  ];

  return (
    <>
      <header className="db-greeting">
        <p className="db-date">{dateLine}</p>
        <h1>{greetingLine(tz, firstNameRow?.first_name)}</h1>
      </header>

      <section className="db-stats" aria-label="This week">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="db-stat">
            <span className="db-stat-number">{s.number}</span>
            <span className="db-label">{s.label}</span>
          </Link>
        ))}
      </section>

      <div className="db-today">
      <section className="db-today-main">
        <div className="db-section-head">
          <h2>Today&apos;s appointments</h2>
          <span className="db-label">{timeZoneLabel(tz)} time</span>
        </div>

        {todays.error && (
          <p className="message error">Couldn&apos;t load today&apos;s bookings: {todays.error.message}</p>
        )}

        {!todays.error && appointments.length === 0 && (
          <div className="db-empty">
            <p className="db-quiet">Nothing booked today.</p>
            <p>
              <Link href="/dashboard/openings">Open some times</Link> or{" "}
              <Link href="/dashboard/bookings">see what&apos;s coming up</Link>.
            </p>
          </div>
        )}

        {appointments.length > 0 && (
          <ol className="db-timeline">
            {appointments.map((b) => {
              const isPast = b.end_time.slice(0, 5) <= nowTime;
              const isRegular = b.client?.status === "regular";
              return (
                <li key={b.id} className={isPast ? "db-slot past" : "db-slot"}>
                  <div className="db-slot-time">
                    {clockTime(b.start_time)}
                    <span>{clockTime(b.end_time)}</span>
                  </div>
                  <div className="db-slot-body">
                    <div className="db-slot-name">
                      {b.client_name}
                      {isRegular && (
                        <span className="badge regular">
                          <RegularStar label={null} size={9} /> Regular
                        </span>
                      )}
                    </div>
                    <div className="db-slot-meta">{b.service_name}</div>
                    <div className="db-slot-tags">
                      {b.status === "pending_payment" ? (
                        <span className="badge unpaid">Paying deposit now</span>
                      ) : (
                        <DepositTag booking={b} />
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* Wide screens only (1200px and up): a right-hand column. */}
      <aside className="db-today-side" aria-label="Coming up">
        <section>
          <div className="db-section-head">
            <h2>Next up</h2>
          </div>
          {nextUp.error ? (
            <p className="muted small-text">Couldn&apos;t load your next appointment.</p>
          ) : nextUp.data ? (
            <div className="db-next">
              <p className="db-next-when">
                {nextUp.data.booking_date === today ? "Today" : shortDay(nextUp.data.booking_date)}{" "}
                · {clockTime(nextUp.data.start_time)}
              </p>
              <p className="db-next-name">{nextUp.data.client_name}</p>
              <p className="muted small-text">{nextUp.data.service_name}</p>
            </div>
          ) : (
            <p className="db-quiet-small">Nothing booked yet.</p>
          )}
        </section>

        <section>
          <div className="db-section-head">
            <h2>Open times this week</h2>
          </div>
          {weekOpenings.error ? (
            <p className="muted small-text">Couldn&apos;t load your open times.</p>
          ) : openTimes.length === 0 ? (
            <p className="db-quiet-small">No open times left this week.</p>
          ) : (
            <ul className="db-open-list">
              {openTimes.map((o) => (
                <li key={o.id}>
                  <span>{shortDay(o.opening_date)}</span>
                  <span>
                    {clockTime(o.start_time)} – {clockTime(o.end_time)}
                    {o.visibility === "regulars" && (
                      <>
                        {" "}
                        <RegularStar size={10} />
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="db-side-link">
            <Link href="/dashboard/openings">Manage openings</Link>
          </p>
        </section>
      </aside>
      </div>
    </>
  );
}

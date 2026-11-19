// Home: the dashboard's overview (what log in lands on). The greeting and
// booking link, this week's numbers, the next few bookings, anything that
// needs attention, quick actions, and a setup checklist for new accounts.
// The detailed day view is Today (/dashboard/today).
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clockTime, formatDate, parseDateString, toDateString, todayInTimeZone } from "@/lib/availability";
import { BRAND_NAME } from "@/lib/brand";
import { getMyPlan } from "@/lib/plan";
import { publicSiteUrl } from "@/lib/siteUrl";
import PageHeader from "@/components/dash/PageHeader";
import CopyLinkButton from "@/components/dash/CopyLinkButton";
import { RowChevron } from "@/components/dash/RowList";
import RegularStar from "@/components/RegularStar";
import ShareLinkButton from "./ShareLinkButton";
import FeedbackPrompt from "./FeedbackPrompt";
import { isAdmin } from "@/lib/admin";
import { exampleData, examplesOn } from "@/lib/examples";
import { ExampleTag } from "@/components/dash/Example";

export const metadata = { title: `Home · ${BRAND_NAME}` };

function greeting(timeZone) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Monday to Sunday of the week that contains `today` ("YYYY-MM-DD").
function weekRange(today) {
  const day = parseDateString(today);
  const monday = new Date(day);
  monday.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: toDateString(monday), end: toDateString(sunday) };
}

const money = (cents) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format((cents || 0) / 100);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // All at once (the extra columns are read on their own, so Home still
  // opens before their SQL is run).
  const [{ data: stylist }, { data: nameRow }, { data: coverRow }, showExamples] = await Promise.all([
    supabase
      .from("stylists")
      .select("business_name, slug, timezone, deposits_enabled, stripe_charges_enabled")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("stylists").select("first_name").eq("id", user.id).maybeSingle(),
    supabase.from("stylists").select("cover_photo_url").eq("id", user.id).maybeSingle(),
    examplesOn(supabase, user.id),
  ]);
  if (!stylist) return null;

  const tz = stylist.timezone;
  const today = todayInTimeZone(tz);
  const week = weekRange(today);
  const monthStart = `${today.slice(0, 8)}01`;
  const nowTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  const stillToCome = `booking_date.gt.${today},and(booking_date.eq.${today},start_time.gt.${nowTime})`;
  const [ty, tm, td] = today.split("-").map(Number);
  const wrapSince = new Date(Date.UTC(ty, tm - 1, td - 13)).toISOString().slice(0, 10);
  const paidSince = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

  const [
    todays,
    weekRows,
    paidDeposits,
    newClients,
    waiting,
    nextUp,
    services,
    hours,
    anyBooking,
    unmarked,
    owed,
    plan,
    standingFlags,
    { data: upcomingIds },
    { data: disputeRows },
    feedbackSent,
  ] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed").eq("booking_date", today),
    supabase
      .from("bookings")
      .select("price_cents, outcome")
      .eq("status", "confirmed")
      .gte("booking_date", week.start)
      .lte("booking_date", week.end),
    supabase.from("bookings").select("deposit_cents, deposit_paid_at").eq("deposit_status", "paid").gte("deposit_paid_at", paidSince),
    supabase.from("clients").select("created_at").gte("created_at", new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString()),
    supabase
      .from("waitlist_entries")
      .select("id, offers:waitlist_offers(notified_at, notify_attempts)")
      .eq("status", "waiting"),
    supabase
      .from("bookings")
      .select("id, booking_date, start_time, end_time, service_name, client_name, client:clients(status)")
      .eq("status", "confirmed")
      .or(stillToCome)
      .order("booking_date")
      .order("start_time")
      .limit(3),
    supabase.from("services").select("id", { count: "exact", head: true }),
    supabase.from("working_hours").select("weekday", { count: "exact", head: true }),
    supabase.from("bookings").select("id", { count: "exact", head: true }),
    supabase
      .from("bookings")
      .select("booking_date, start_time")
      .eq("status", "confirmed")
      .is("outcome", null)
      .gte("booking_date", wrapSince)
      .lte("booking_date", today),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed").eq("outcome", "completed_owed"),
    getMyPlan(supabase, user.id),
    supabase.rpc("standing_flags"),
    // Upcoming bookings, to check for missing intake forms below.
    supabase.from("bookings").select("id").eq("status", "confirmed").or(stillToCome).limit(300),
    // Deposits a client has disputed (step 39 SQL).
    supabase.from("deposit_disputes").select("id, status"),
    // Trial feedback already sent (step 38 SQL).
    supabase.from("trial_feedback").select("id", { count: "exact", head: true }).eq("stylist_id", user.id),
  ]);

  // Upcoming bookings of services that need an intake form, without one on file.
  let formsMissing = 0;
  if (upcomingIds?.length) {
    const { data: intakeRows } = await supabase.rpc("bookings_intake", { p_booking_ids: upcomingIds.map((r) => r.id) });
    formsMissing = (intakeRows || []).filter((r) => r.needed && !r.on_file).length;
  }

  const dayOf = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
  const weekRevenue = (weekRows.data || [])
    .filter((b) => b.outcome !== "no_show")
    .reduce((sum, b) => sum + (b.price_cents || 0), 0);
  const depositsThisWeek = (paidDeposits.data || [])
    .filter((b) => {
      const day = dayOf(b.deposit_paid_at);
      return day >= week.start && day <= week.end;
    })
    .reduce((sum, b) => sum + (b.deposit_cents || 0), 0);
  const newThisMonth = (newClients.data || []).filter((c) => dayOf(c.created_at) >= monthStart).length;
  const waitingCount = (waiting.data || []).length;
  const emailProblems = (waiting.data || []).filter((e) =>
    (e.offers || []).some((o) => !o.notified_at && o.notify_attempts > 0)
  ).length;
  const toWrapUp = (unmarked.data || []).filter(
    (b) => b.booking_date < today || String(b.start_time).slice(0, 5) <= nowTime
  ).length;
  const owedCount = owed.count || 0;
  const flagCount = (standingFlags.data || []).length;

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  const bookingLink = `${publicSiteUrl(`${proto}://${host}`)}/book/${stylist.slug}`;

  const dash = (q, value) => (q.error ? "—" : value);
  const cards = [
    { label: "Today's bookings", value: dash(todays, todays.count ?? 0), href: "/dashboard/today" },
    { label: "This week's revenue", value: dash(weekRows, money(weekRevenue)), note: "Booked Mon–Sun", href: "/dashboard/reports" },
    { label: "Deposits collected", value: dash(paidDeposits, money(depositsThisWeek)), note: "This week", href: "/dashboard/reports" },
    { label: "New clients", value: dash(newClients, newThisMonth), note: "This month", href: "/dashboard/clients" },
    { label: "Waitlist", value: dash(waiting, waitingCount), note: "Waiting now", href: "/dashboard/waitlist" },
  ];

  // Needs attention: only what's actually there.
  const attention = [];
  if (plan.subscribed && plan.cancelling) {
    attention.push({ text: `Your plan ends on ${formatDate(String(plan.cancelAt).slice(0, 10))}`, href: "/dashboard/settings/plan", action: "Reactivate" });
  } else if (plan.stripeStatus === "past_due") {
    attention.push({ text: "Your last plan payment didn't go through", href: "/dashboard/settings/plan", action: "Fix payment" });
  } else if (!plan.comped && !plan.subscribed && plan.inTrial && plan.daysLeft <= 3) {
    attention.push({ text: `Your free trial ends in ${plural(plan.daysLeft, "day", "days")}`, href: "/dashboard/settings/plan", action: "Choose a plan" });
  } else if (plan.ready && !plan.has.base) {
    attention.push({ text: "Your plan is paused", href: "/dashboard/settings/plan", action: "Choose a plan" });
  }
  if (toWrapUp > 0) attention.push({ text: `${plural(toWrapUp, "visit", "visits")} to wrap up`, href: "/dashboard/wrapup", action: "Wrap up" });
  if (owedCount > 0) attention.push({ text: `${plural(owedCount, "balance", "balances")} owed`, href: "/dashboard/wrapup#owed", action: "See" });
  if (flagCount > 0) attention.push({ text: `${plural(flagCount, "standing visit", "standing visits")} to check`, href: "/dashboard/today", action: "Check" });
  if (emailProblems > 0) {
    attention.push({ text: `${plural(emailProblems, "waitlist email", "waitlist emails")} couldn't be sent`, href: "/dashboard/waitlist", action: "See" });
  }
  if (formsMissing > 0) {
    attention.push({ text: `${plural(formsMissing, "upcoming booking is", "upcoming bookings are")} missing an intake form`, href: "/dashboard/bookings", action: "See" });
  }
  // Deposits a client has disputed with their bank (step 39 SQL).
  const openDisputes = (disputeRows || []).filter((d) =>
    ["warning_needs_response", "needs_response", "under_review", "warning_under_review"].includes(d.status)
  ).length;
  if (openDisputes > 0) {
    attention.unshift({
      text: `${plural(openDisputes, "deposit is", "deposits are")} disputed by a client (check your email)`,
      href: "/dashboard/bookings",
      action: "See",
    });
  }
  if (!stylist.stripe_charges_enabled) {
    attention.push({ text: "Stripe isn't connected, so you can't take deposits", href: "/dashboard/settings/deposits", action: "Connect" });
  }

  // Setup checklist for new accounts; hidden once everything is done.
  const setup = [
    { done: (services.count || 0) > 0, text: "Add your services", href: "/dashboard/services" },
    { done: (hours.count || 0) > 0, text: "Set your working hours", href: "/dashboard/availability" },
    { done: Boolean(stylist.stripe_charges_enabled), text: "Connect Stripe for deposits", href: "/dashboard/settings/deposits" },
    { done: Boolean(coverRow?.cover_photo_url), text: "Add a cover photo", href: "/dashboard/settings/booking-page" },
    { done: (anyBooking.count || 0) > 0, text: "Share your booking link (done after your first booking)", href: "/dashboard/openings" },
  ];
  const setupLeft = setup.filter((s) => !s.done).length;

  // Example Up next rows for a new pro with nothing booked yet.
  const upNext =
    !nextUp.error && (nextUp.data || []).length === 0 && (anyBooking.count || 0) === 0 && showExamples
      ? exampleData(today).upcoming
      : nextUp.data || [];

  // Trial feedback: from day 3 of the free trial until they've sent some.
  let askFeedback = false;
  if (plan.inTrial && !plan.comped && !plan.subscribed && plan.daysLeft <= 11) {
    askFeedback = !feedbackSent.error && !feedbackSent.count;
  }

  const name = String(nameRow?.first_name || "").trim();
  const dateLine = parseDateString(today).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <PageHeader
        eyebrow={dateLine}
        title={name ? `${greeting(tz)}, ${name}` : greeting(tz)}
        subtitle={stylist.business_name}
        actions={
          <>
            <CopyLinkButton link={bookingLink} />
            <a href={bookingLink} target="_blank" rel="noreferrer" className="button small">
              View booking page
            </a>
          </>
        }
      />

      {askFeedback && <FeedbackPrompt daysLeft={plan.daysLeft} />}

      {setupLeft > 0 && (
        <section className="card home-setup">
          <h2>Get set up</h2>
          <p className="muted small-text">
            {setup.length - setupLeft} of {setup.length} done.
          </p>
          <ul className="home-checklist">
            {setup.map((s) => (
              <li key={s.text} className={s.done ? "done" : ""}>
                <span className="home-check" aria-hidden="true" />
                {s.done ? <span>{s.text}</span> : <Link href={s.href}>{s.text}</Link>}
                <span className="visually-hidden">{s.done ? " (done)" : " (to do)"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="home-cards" aria-label="At a glance">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="home-card">
            <span className="db-label">{c.label}</span>
            <strong className="home-card-value">{c.value}</strong>
            {c.note && <span className="muted small-text">{c.note}</span>}
          </Link>
        ))}
      </section>

      <div className="home-grid">
        <section className="card">
          <div className="home-section-head">
            <h2>Up next</h2>
            <Link href="/dashboard/today" className="small-text">
              Today →
            </Link>
          </div>
          {upNext.length === 0 ? (
            <div className="db-empty">
              <p className="db-empty-title">Nothing booked yet</p>
              <p className="muted small-text">Open some times and share your booking link.</p>
            </div>
          ) : (
            <ul className="client-rows">
              {upNext.map((b) => (
                <li key={b.id}>
                  <Link href="/dashboard/bookings" className="client-row booking-row">
                    <span className="booking-row-time">
                      <strong>{clockTime(b.start_time)}</strong>
                      <span>{b.booking_date === today ? "Today" : formatDate(b.booking_date).replace(/, \d{4}$/, "")}</span>
                    </span>
                    <span className="client-row-main">
                      <span className="client-row-name">
                        <span className="client-row-text">{b.client_name}</span>
                        {b.client?.status === "regular" && <RegularStar label="Regular" size={10} />}
                        {b.example && <ExampleTag />}
                      </span>
                      <span className="client-row-phone">{b.service_name}</span>
                    </span>
                    <RowChevron />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2>Needs attention</h2>
          {attention.length === 0 ? (
            <p className="muted">All clear. Nothing needs you right now.</p>
          ) : (
            <ul className="client-rows">
              {attention.map((a) => (
                <li key={a.text}>
                  <Link href={a.href} className="client-row home-attention">
                    <span className="home-attention-dot" aria-hidden="true" />
                    <span className="client-row-main">
                      <span className="client-row-text">{a.text}</span>
                    </span>
                    <span className="home-attention-action">{a.action}</span>
                    <RowChevron />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Quick actions</h2>
        <div className="home-actions">
          <Link href="/dashboard/openings#add-opening" className="button secondary small">
            + Add opening
          </Link>
          <Link href="/dashboard/bookings?add=event" className="button secondary small">
            + Add event
          </Link>
          <Link href="/dashboard/clients?add=client#add-client" className="button secondary small">
            + Add client
          </Link>
          <ShareLinkButton link={bookingLink} businessName={stylist.business_name} />
        </div>
        <p className="muted small-text home-more-links">
          <Link href="/dashboard/today">Today</Link> · <Link href="/dashboard/reports">Reports</Link> ·{" "}
          <Link href="/dashboard/wrapup">Wrap up visits</Link> ·{" "}
          <Link href="/dashboard/feedback">Share feedback</Link>
          {isAdmin(user) && (
            <>
              {" "}
              · <Link href="/dashboard/admin/feedback">Trial feedback (admin)</Link> ·{" "}
              <Link href="/dashboard/admin/disputes">Disputes (admin)</Link>
            </>
          )}
        </p>
      </section>
    </>
  );
}

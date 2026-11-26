// Home: the dashboard's overview (what log in lands on). The greeting and
// booking link, this week's numbers, the next few bookings, anything that
// needs attention, quick actions, and a setup checklist for new accounts.
// The detailed day view is Today (/dashboard/today).
import { getUser } from "@/lib/supabase/user";
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
import ShareCta from "./shell/ShareCta";
import WeekMeter from "./home/WeekMeter";
import MoneyCurve from "./home/MoneyCurve";
import FillMoves from "./home/FillMoves";
import FeedbackPrompt from "./FeedbackPrompt";
import { isAdmin } from "@/lib/admin";
import { EXAMPLE_HOME_STATS, exampleData, examplesOn } from "@/lib/examples";
import { setupSteps } from "@/lib/setupSteps";
import { ExampleTag } from "@/components/dash/Example";
import { lateText, recentLateNotices } from "@/lib/lateNotices";
import { isDemo } from "@/lib/demo";
import { getMyTemplate } from "@/lib/templates/server";
import { earnings, moneyPeriod, owedOn } from "@/lib/moneyTab";
import { insights } from "@/lib/insights";
import { monthCurve, pickMoves, weekFill } from "@/lib/homeFill";

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

// "YYYY-MM-DD" + n days.
const plusDays = (date, n) => {
  const d = parseDateString(date);
  d.setDate(d.getDate() + n);
  return toDateString(d);
};

// What earnings() needs from bookings (the same columns Money reads).
const MONEY_COLS =
  "id, booking_date, start_time, status, outcome, price_cents, deposit_cents, deposit_status, deposit_paid_at, owed_cents, client_id, client_name, client_email, service_name";

const money = (cents) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format((cents || 0) / 100);

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default async function HomePage() {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) redirect("/login");

  // All at once (the extra columns are read on their own, so Home still
  // opens before their SQL is run).
  const [{ data: stylist }, { data: nameRow }, { data: coverRow }, showExamples, { data: codeRow }] = await Promise.all([
    supabase
      .from("stylists")
      .select("business_name, slug, timezone, deposits_enabled, stripe_charges_enabled")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("stylists").select("first_name").eq("id", user.id).maybeSingle(),
    supabase.from("stylists").select("cover_photo_url").eq("id", user.id).maybeSingle(),
    examplesOn(supabase, user.id),
    supabase.from("stylists").select("pro_code").eq("id", user.id).maybeSingle(),
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
  // Fill your book: this week and next (openings), this month and last
  // (money), and about a year of visits (who's overdue, as Insights works it out).
  const nextWeekEnd = plusDays(week.end, 7);
  const thisMonth = moneyPeriod("month", today);
  const lastMonth = moneyPeriod("month", thisMonth.prev);
  const nowLocal = `${today}T${nowTime}`;

  const [
    todays,
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
    fillOpenings,
    fillBookings,
    moneyVisits,
    moneyDepositsPaid,
    moneyPayments,
    owedVisits,
    balancePayments,
    yearVisits,
    clientEmails,
    late,
  ] = await Promise.all([
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed").eq("booking_date", today),
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
    // Fill your book: openings this week and next, and this week's bookings.
    supabase.from("openings").select("opening_date, start_time, end_time").gte("opening_date", week.start).lte("opening_date", nextWeekEnd).limit(2000),
    supabase
      .from("bookings")
      .select("booking_date, start_time, end_time, status")
      .in("status", ["confirmed", "pending_payment"])
      .gte("booking_date", week.start)
      .lte("booking_date", week.end),
    // This month and last, read the way Money reads them (lib/moneyData.js).
    supabase.from("bookings").select(MONEY_COLS).gte("booking_date", lastMonth.from).lte("booking_date", thisMonth.to).limit(5000),
    supabase
      .from("bookings")
      .select(MONEY_COLS)
      .gte("deposit_paid_at", `${plusDays(lastMonth.from, -1)}T00:00:00Z`)
      .lte("deposit_paid_at", `${plusDays(thisMonth.to, 1)}T23:59:59Z`)
      .limit(5000),
    supabase.from("payments").select("booking_id, kind, method, amount_cents, paid_on").gte("paid_on", lastMonth.from).lte("paid_on", thisMonth.to).limit(5000),
    // Balances owed, less balances already paid.
    supabase.from("bookings").select(`${MONEY_COLS}, balance_reminded_at`).eq("status", "confirmed").eq("outcome", "completed_owed").limit(500),
    supabase.from("payments").select("booking_id, amount_cents").eq("kind", "balance").limit(5000),
    // Who's overdue (the same read as Insights).
    supabase
      .from("bookings")
      // Only visits that happened or are booked: the overdue check never uses
      // cancelled ones, so they aren't fetched.
      .select("id, client_id, client_name, client_email, service_id, service_name, booking_date, start_time, status, outcome, price_cents")
      .eq("status", "confirmed")
      .gte("booking_date", plusDays(today, -400))
      .lte("booking_date", plusDays(today, 120))
      .limit(10000),
    supabase.from("clients").select("id, email, invited_back_at"),
    // Clients running late (step 46 SQL).
    recentLateNotices(supabase),
  ]);

  // Upcoming bookings of services that need an intake form, without one on file.
  let formsMissing = 0;
  if (upcomingIds?.length) {
    const { data: intakeRows } = await supabase.rpc("bookings_intake", { p_booking_ids: upcomingIds.map((r) => r.id) });
    formsMissing = (intakeRows || []).filter((r) => r.needed && !r.on_file).length;
  }

  const dayOf = (iso) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso));
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

  // ---------- Fill your book ----------
  const tplFill = await getMyTemplate();
  const fillEx = showExamples ? exampleData(today, tplFill) : null;
  const realOpenings = fillOpenings.data || [];
  const realWeekBookings = fillBookings.data || [];
  const thisWeekOpenings = realOpenings.filter((o) => o.opening_date <= week.end);
  // Examples only when the week has no real openings and no real bookings.
  const weekExamples = Boolean(fillEx) && thisWeekOpenings.length === 0 && realWeekBookings.length === 0;
  const weekData = {
    ...weekFill({
      week,
      today,
      nowTime,
      openings: weekExamples ? fillEx.openings.filter((o) => o.opening_date >= week.start && o.opening_date <= week.end) : thisWeekOpenings,
      bookings: weekExamples ? fillEx.bookings.filter((b) => b.booking_date >= week.start && b.booking_date <= week.end) : realWeekBookings,
    }),
    examples: weekExamples,
  };

  // Money: merged and dated the way lib/moneyData.js does, so the totals match Money.
  const localDay = (iso) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso)) : null);
  const moneyRows = new Map();
  for (const b of [...(moneyVisits.data || []), ...(moneyDepositsPaid.data || [])]) moneyRows.set(b.id, { ...b, deposit_paid_at: localDay(b.deposit_paid_at) });
  const thisEarned = earnings({ bookings: [...moneyRows.values()], payments: moneyPayments.data || [], period: thisMonth, now: nowLocal });
  const lastEarned = earnings({ bookings: [...moneyRows.values()], payments: moneyPayments.data || [], period: lastMonth, now: nowLocal });
  const toDays = (e) => e.series.map((s, i) => ({ day: i + 1, cents: s.cents }));
  // Examples only when neither month has anything.
  const monthExamples = Boolean(fillEx) && thisEarned.totalCents === 0 && lastEarned.totalCents === 0;
  const exEarned = monthExamples
    ? earnings({ bookings: fillEx.past.map((b) => ({ ...b, status: "confirmed" })), payments: [], period: thisMonth, now: nowLocal })
    : null;
  const monthName = (p) => parseDateString(p.from).toLocaleDateString("en-US", { month: "long" });
  const monthData = {
    ...monthCurve({
      thisDays: toDays(exEarned || thisEarned),
      lastDays: monthExamples ? [] : toDays(lastEarned),
      todayDay: Number(today.slice(8, 10)),
    }),
    label: monthName(thisMonth),
    lastLabel: monthName(lastMonth),
    depositsCents: (exEarned || thisEarned).depositsCents,
    examples: monthExamples,
  };

  // Moves: biggest balance owed, an overdue client, a thin week ahead, or sharing.
  const paidBalances = new Map();
  for (const p of balancePayments.data || []) paidBalances.set(p.booking_id, (paidBalances.get(p.booking_id) || 0) + p.amount_cents);
  const owedList = (owedVisits.data || [])
    .map((b) => ({
      bookingId: b.id,
      clientName: b.client_name,
      serviceName: b.service_name,
      owedCents: owedOn(b, paidBalances),
      hasEmail: Boolean(b.client_email),
      // remindBalance allows one reminder every 3 days.
      remindedRecently: Boolean(b.balance_reminded_at) && Date.now() - new Date(b.balance_reminded_at).getTime() < 3 * 86400000,
    }))
    .filter((o) => o.owedCents > 0);
  const clientsById = new Map((clientEmails.data || []).map((c) => [c.id, c]));
  const recently = (c) => Boolean(c?.invited_back_at) && Date.now() - new Date(c.invited_back_at).getTime() < 30 * 86400000;
  const overdueList = yearVisits.error
    ? []
    : insights({
        bookings: yearVisits.data || [],
        payments: [],
        range: { from: thisMonth.from, to: today, prevFrom: lastMonth.from, prevTo: lastMonth.to },
        now: nowLocal,
        today,
        workingCells: new Set(),
      }).overdue.map((o) => ({
        clientId: o.clientId,
        bookingId: o.bookingId,
        serviceId: o.serviceId,
        name: o.name,
        usualWeeks: o.usual ? Math.max(1, Math.round(o.usual / 7)) : null,
        sinceWeeks: Math.round(o.since / 7),
        hasEmail: Boolean((o.clientId && clientsById.get(o.clientId)?.email) || o.email),
        invitedRecently: recently(o.clientId && clientsById.get(o.clientId)),
      }));
  // Openings are time ranges, so next week is measured in open minutes.
  const spanMin = (o) => {
    const [sh, sm] = String(o.start_time).split(":").map(Number);
    const [eh, em] = String(o.end_time).split(":").map(Number);
    return Math.max(0, eh * 60 + em - (sh * 60 + sm));
  };
  const nextWeekOpenMin = realOpenings.filter((o) => o.opening_date > week.end).reduce((a, o) => a + spanMin(o), 0);
  const movesData = pickMoves({
    owed: owedList,
    overdue: overdueList,
    nextWeekOpenMin,
    thisWeekOfferedMin: thisWeekOpenings.reduce((a, o) => a + spanMin(o), 0),
    thisWeekOpenMinLeft: weekData.openMinLeft,
    hasServices: (services.count || 0) > 0,
    hasOpeningsAhead: realOpenings.some((o) => o.opening_date >= today),
  });

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  const bookingLink = `${publicSiteUrl(`${proto}://${host}`)}/book/${stylist.slug}`;

  // The old stats row's figures, in their new places: today's count in the
  // greeting line, new clients and the waitlist in More (deposits are under
  // This month). A new pro with nothing booked sees example numbers.
  const exampleStats = showExamples && (anyBooking.count || 0) === 0 && !nextUp.error ? EXAMPLE_HOME_STATS : null;
  const tpl = await getMyTemplate();
  const W = tpl.words;
  // Real visits only: the greeting line never counts example bookings.
  const todayCount = todays.count ?? 0;
  const newCount = exampleStats ? exampleStats.newClients : newThisMonth;
  const waitCount = exampleStats ? exampleStats.waiting : waitingCount;

  // Needs attention: only what's actually there.
  const exampleStatsOn = showExamples && (anyBooking.count || 0) === 0;
  const attention = [];
  // Clients running late (step 46 SQL), or an example one for a new pro.
  for (const n of late) attention.unshift({ text: lateText(n), href: "/dashboard/today", action: "See" });
  if (!late.length && exampleStatsOn) {
    attention.unshift({ text: "Maya Jones is running 10 min late (Example)", href: "/dashboard/today", action: "See" });
  }
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

  // Setup checklist for new accounts; hidden once everything is done. Until a
  // client could actually book (a service and an open time), it leads the page
  // and the share button waits.
  const { steps: setup, bookable, left: setupLeft } = setupSteps({
    services: services.count || 0,
    hours: hours.count || 0,
    openingsAhead: realOpenings.filter((o) => o.opening_date >= today).length,
    stripe: Boolean(stylist.stripe_charges_enabled),
    cover: Boolean(coverRow?.cover_photo_url),
    booked: (anyBooking.count || 0) > 0,
  });

  // Example Up next rows for a new pro with nothing booked yet.
  const upNext =
    !nextUp.error && (nextUp.data || []).length === 0 && (anyBooking.count || 0) === 0 && showExamples
      ? exampleData(today, await getMyTemplate()).upcoming
      : nextUp.data || [];

  // Trial feedback: from day 3 of the free trial until they've sent some.
  let askFeedback = false;
  if (plan.inTrial && !plan.comped && !plan.subscribed && plan.daysLeft <= 11) {
    askFeedback = !feedbackSent.error && !feedbackSent.count;
  }

  const showSetup = setupLeft > 0 && !isDemo(user);
  const setupFirst = showSetup && !bookable;
  const setupCard = showSetup ? (
        <section className={`card home-setup${!bookable ? " home-setup-lead" : ""}`}>
          <h2>{bookable ? "Get set up" : "Get your booking page ready"}</h2>
          <p className="muted small-text">
            {bookable
              ? `${setup.length - setupLeft} of ${setup.length} done.`
              : "Clients can book once you have a service and some open times. The examples below show how Home looks after that."}
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
  ) : null;

  const name = String(nameRow?.first_name || "").trim();
  const dateLine = parseDateString(today).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Order of operations: set up first, then what's next and what needs you,
  // then the numbers. Secondary links and admin tools are folded away.
  const proCode = codeRow?.pro_code;
  return (
    <>
      <PageHeader
        guide="home"
        eyebrow={dateLine}
        title={name ? `${greeting(tz)}, ${name}` : greeting(tz)}
        subtitle={`${todayCount} ${todayCount === 1 ? W.appointment || "appointment" : W.appointments || "appointments"} today · ${stylist.business_name}`}
        actions={
          <>
            {proCode && <CopyLinkButton link={proCode} label={`Pro ID ${proCode}`} className="button small ghost" />}
            <a href={bookingLink} target="_blank" rel="noreferrer" className="button small secondary">
              View booking page
            </a>
            {bookable && <ShareCta url={bookingLink} businessName={stylist.business_name} />}
          </>
        }
      />

      {setupFirst && setupCard}

      <section className="hf-hero" aria-label="Your week and your month">
        <WeekMeter week={weekData} today={today} />
        <MoneyCurve month={monthData} today={today} />
      </section>

      <section className="hf-moves-wrap" aria-labelledby="fill-your-book">
        <h2 id="fill-your-book">Fill your book</h2>
        <FillMoves moves={movesData} bookingUrl={bookingLink} businessName={stylist.business_name} />
      </section>

      {askFeedback && <FeedbackPrompt daysLeft={plan.daysLeft} />}

      {!setupFirst && setupCard}


      <div className="g12 g12-even">
        <section className="card span-8">
          <div className="home-section-head">
            <h2>Up next</h2>
            <Link href="/dashboard/today" className="small-text">
              Today →
            </Link>
          </div>
          {upNext.length === 0 ? (
            <div className="empty-mini">
              <span className="empty-mini-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
                  <path d="M3.5 9.5h17M8 3v4M16 3v4" />
                </svg>
              </span>
              <p>Nothing booked yet.</p>
              <Link href="/dashboard/openings#add-opening" className="button small">
                Add opening
              </Link>
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

        <section className="card span-4">
          <h2>Needs attention</h2>
          {attention.length === 0 ? (
            <div className="empty-mini">
              <span className="empty-mini-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
              </span>
              <p>All clear.</p>
            </div>
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
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>


      <details className="card fold">
        <summary>More</summary>
        <p className="fold-stats">
          New {W.clients || "clients"} this month: <strong>{newCount}</strong>
          {tpl.modules.waitlist !== false && (
            <>
              {" · "}
              <Link href="/dashboard/openings?tab=waitlist">
                Waiting on your waitlist: <strong>{waitCount}</strong>
              </Link>
            </>
          )}
          {exampleStats && <> <ExampleTag /></>}
        </p>
        <ul className="fold-links">
          <li>
            <Link href="/dashboard/wrapup">Wrap up visits</Link>
          </li>
          <li>
            <Link href="/dashboard/share">Share kit (QR code and story)</Link>
          </li>
          {tpl.modules.projects && (
            <li>
              <Link href="/dashboard/projects">Projects</Link>
            </li>
          )}
          {tpl.modules.packages && (
            <li>
              <Link href="/dashboard/packages">Packages</Link>
            </li>
          )}
          <li>
            <Link href="/dashboard/activity">Activity</Link>
          </li>
          <li>
            <Link href="/dashboard/feedback">Share feedback</Link>
          </li>
        </ul>
      </details>

      {isAdmin(user) && (
        <details className="card fold">
          <summary>Admin</summary>
          <ul className="fold-links">
            <li>
              <Link href="/dashboard/admin/control">Control Room</Link>
            </li>
            <li>
              <CopyLinkButton link="https://www.clientelesuite.com/demo" label="Copy demo link" className="link-button" />
            </li>
            <li>
              <Link href="/dashboard/admin/feedback">Trial feedback</Link>
            </li>
            <li>
              <Link href="/dashboard/admin/disputes">Disputes</Link>
            </li>
            <li>
              <Link href="/dashboard/admin/errors">Errors</Link>
            </li>
          </ul>
        </details>
      )}
    </>
  );
}

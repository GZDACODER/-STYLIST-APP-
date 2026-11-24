import PageHeader from "@/components/dash/PageHeader";
import { exampleData, examplesOn } from "@/lib/examples";
import { ExampleTag } from "@/components/dash/Example";
import EmptyState from "@/components/dash/EmptyState";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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
import StandingFlags from "../standing/StandingFlags";
import { eventsOn } from "@/lib/calendarEvents";
import { holidaysOn } from "@/lib/holidays";
import LateNotices from "./LateNotices";
import { recentLateNotices } from "@/lib/lateNotices";
import { getMyTemplate } from "@/lib/templates/server";
import Words from "@/components/Words";

export const metadata = { title: `Today · ${BRAND_NAME}` };

const ACTION_WORDS = {
  cancelled: "cancelled from their email",
  rescheduled: "moved their appointment",
  running_late: "is running late",
  calendar: "added it to their calendar",
  waiver_signed: "signed your waiver",
};

function agoShort(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `${Math.max(1, m)} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hr ago` : `${Math.round(h / 24)} days ago`;
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

  const tz = stylist.timezone;
  const today = todayInTimeZone(tz);
  const week = weekRange(today);
  const nowTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());

  const stillToCome = `booking_date.gt.${today},and(booking_date.eq.${today},start_time.gt.${nowTime})`;

  const [todays, nextUp, weekOpenings] =
    await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, start_time, end_time, service_name, client_name, status, deposit_cents, deposit_status, hold_expires_at, client:clients(status)"
      )
      .eq("booking_date", today)
      .in("status", ["confirmed", "pending_payment"])
      .order("start_time"),
    // The next appointment, and the open times left this week.
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
  // Standing appointments (read on their own, so the page still opens
  // before the step 16 SQL is run).
  const [{ data: standingFlags }, { data: standingToday }] = await Promise.all([
    supabase.rpc("standing_flags"),
    supabase
      .from("bookings")
      .select("id")
      .eq("booking_date", today)
      .not("standing_series_id", "is", null),
  ]);
  const standingIds = new Set((standingToday || []).map((r) => r.id));

  // Wrap up visits: finished visits not marked yet (last 14 days) and
  // balances owed. Read on their own, so the page still opens before the
  // step 18 SQL is run.
  const [ty, tm, td] = today.split("-").map(Number);
  const wrapSince = new Date(Date.UTC(ty, tm - 1, td - 13)).toISOString().slice(0, 10);
  const [{ data: unmarkedRows }, { count: owedCount }] = await Promise.all([
    supabase
      .from("bookings")
      .select("booking_date, start_time")
      .eq("status", "confirmed")
      .is("outcome", null)
      .gte("booking_date", wrapSince)
      .lte("booking_date", today),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed")
      .eq("outcome", "completed_owed"),
  ]);
  // The stylist's own events and today's holiday (events are read on their
  // own, so the page still opens before the step 29 SQL is run).
  const { data: eventRows } = await supabase
    .from("calendar_events")
    .select("*")
    .lte("starts_on", week.end)
    .limit(2000);
  const allEvents = eventRows || [];
  const todaysEvents = eventsOn(allEvents, today);
  const todaysHolidays = holidaysOn(today);
  // The rest of this week (tomorrow to Sunday), for the side column.
  const laterEvents = [];
  for (let d = parseDateString(today), i = 0; i < 7; i++) {
    d.setDate(d.getDate() + 1);
    const date = toDateString(d);
    if (date > week.end) break;
    for (const e of eventsOn(allEvents, date)) laterEvents.push({ ...e, date });
  }

  const toWrapUp = (unmarkedRows || []).filter(
    (b) => b.booking_date < today || b.start_time.slice(0, 5) <= nowTime
  ).length;


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


  // Confirmed ones, plus anyone paying their deposit right now.
  const now = Date.now();
  const appointments = (todays.data || []).filter(
    (b) => b.status === "confirmed" || new Date(b.hold_expires_at).getTime() > now
  );
  // Bookings whose client hasn't signed the waiver yet (step 55 SQL).
  const realIds = appointments.filter((b) => !b.example && b.id).map((b) => b.id);
  const { data: missingRows } = realIds.length
    ? await supabase.rpc("bookings_missing_waiver", { p_booking_ids: realIds })
    : { data: [] };
  // Reference photos clients added when booking (step 56 SQL).
  const photosOf = {};
  if (realIds.length) {
    const { data: ph } = await supabase.from("booking_photos").select("booking_id, path").in("booking_id", realIds);
    if (ph?.length) {
      const { data: signed } = await createAdminClient().storage.from("booking-photos").createSignedUrls(ph.map((p) => p.path), 3600);
      const urlOf = Object.fromEntries((signed || []).filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
      for (const p of ph) if (urlOf[p.path]) (photosOf[p.booking_id] ||= []).push(urlOf[p.path]);
    }
  }
  const missingWaiver = new Set((missingRows || []).map((r) => (typeof r === "string" ? r : r.bookings_missing_waiver || r.id)));

  // Examples for a new pro with nothing booked at all (today or later):
  // example appointments today and an example Next up.
  let exampleNext = null;
  if (!todays.error && appointments.length === 0 && !nextUp.data && (await examplesOn(supabase, user.id))) {
    const ex = exampleData(today, await getMyTemplate());
    appointments.push(...ex.upcoming.filter((b) => b.booking_date === today));
    exampleNext = ex.upcoming.find((b) => b.booking_date > today) || null;
  }
  // Clients running late (step 46 SQL); an example one alongside example
  // appointments.
  let lateNotices = await recentLateNotices(supabase);
  if (!lateNotices.length && exampleNext) {
    lateNotices = [{ id: "example-late", minutes: 10, example: true, booking: { client_name: "Maya Jones", service_name: (await getMyTemplate()).presets.services?.[0]?.name || "Appointment", start_time: "14:00:00" } }];
  }

  // What clients did from their email links in the last 3 days (step 53 SQL).
  const { data: activityRows } = await supabase
    .from("client_activity")
    .select("id, created_at, client_name, action, detail")
    .gte("created_at", new Date(Date.now() - 3 * 86400000).toISOString())
    .order("created_at", { ascending: false })
    .limit(10);
  const clientActivity = activityRows || [];

  // Today's timeline: all-day events first, then appointments and timed
  // events in time order.
  const timeline = [
    ...todaysEvents.filter((e) => !e.start_time).map((e) => ({ kind: "event", sort: "", item: e })),
    ...[
      ...appointments.map((b) => ({ kind: "booking", sort: b.start_time.slice(0, 5), item: b })),
      ...todaysEvents
        .filter((e) => e.start_time)
        .map((e) => ({ kind: "event", sort: e.start_time.slice(0, 5), item: e })),
    ].sort((a, b) => a.sort.localeCompare(b.sort)),
  ];

  const dateLine = parseDateString(today).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });


  // The day in one line, under the title.
  const realToday = appointments.filter((b) => !b.example);
  const upcomingToday = appointments.filter((b) => b.start_time.slice(0, 5) > nowTime);
  const daySummary = [
    `${appointments.length} ${appointments.length === 1 ? "appointment" : "appointments"} today`,
    upcomingToday.length > 0 && upcomingToday.length < appointments.length
      ? `${upcomingToday.length} still to come`
      : null,
    upcomingToday.length > 0 && realToday.length > 0 ? `next at ${clockTime(upcomingToday[0].start_time)}` : null,
    `${openTimes.length} open ${openTimes.length === 1 ? "time" : "times"} left this week`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        hero
        mark={Number(today.slice(8))}
        eyebrow={dateLine.replace(/,? \d+$/, "").replace(", ", " · ")}
        title="Today"
        guide="today"
        subtitle={daySummary}
        actions={
          <Link href="/dashboard/openings#add-opening" className="button small">
            + Add opening
          </Link>
        }
      />

      <LateNotices notices={lateNotices} />

      {clientActivity.length > 0 && (
        <section className="db-activity" aria-label="From your clients">
          <h2 className="db-label">
            <Words>From your clients</Words>
          </h2>
          <ul>
            {clientActivity.map((a) => (
              <li key={a.id}>
                <strong>{a.client_name || "A client"}</strong> {ACTION_WORDS[a.action] || a.action}
                {a.detail ? ` (${a.detail})` : ""}
                <span className="muted small-text"> · {agoShort(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(toWrapUp > 0 || owedCount > 0) && (
        <section className="db-wrapup" aria-label="Wrap up visits">
          <p>
            {toWrapUp > 0 && (
              <>
                <strong>{toWrapUp === 1 ? "1 visit" : `${toWrapUp} visits`} to wrap up.</strong>{" "}
                Mark each one completed, no-show or someone else came.
              </>
            )}
            {toWrapUp > 0 && owedCount > 0 && " "}
            {owedCount > 0 && (
              <span className="muted">
                {owedCount === 1 ? "1 balance owed." : `${owedCount} balances owed.`}
              </span>
            )}
          </p>
          <Link href={toWrapUp > 0 ? "/dashboard/wrapup" : "/dashboard/wrapup#owed"}>
            {toWrapUp > 0 ? "Wrap up visits" : "See balances"}
          </Link>
        </section>
      )}

      <StandingFlags flags={Array.isArray(standingFlags) ? standingFlags : []} />

      <div className="db-today">
      <section className="db-today-main">
        <div className="db-section-head">
          <h2><Words>{"Today's appointments"}</Words></h2>
          <span className="db-label">{timeZoneLabel(tz)} time</span>
        </div>

        {todaysHolidays.length > 0 && (
          <p className="db-holiday">
            {todaysHolidays.map((h) => h.name).join(" · ")}
            {todaysHolidays.some((h) => h.federal) && <span className="muted small-text"> · Federal holiday</span>}
          </p>
        )}

        {todays.error && (
          <p className="message error">Couldn&apos;t load today&apos;s bookings: {todays.error.message}</p>
        )}

        {!todays.error && appointments.length === 0 && (
          <EmptyState
            title="Nothing booked today"
            text={todaysEvents.length ? "Just your events below." : "Open some times so clients can book."}
            action={
              <Link href="/dashboard/openings#add-opening" className="button small">
                Open some times
              </Link>
            }
          />
        )}

        {timeline.length > 0 && (
          <ol className="db-timeline">
            {timeline.map(({ kind, item }) => {
              if (kind === "event") {
                const e = item;
                const isPast = e.end_time && e.end_time.slice(0, 5) <= nowTime;
                return (
                  <li key={`e-${e.id}`} className={`db-slot db-slot-event${isPast ? " past" : ""}`}>
                    <div className="db-slot-time">
                      {e.start_time ? (
                        <>
                          {clockTime(e.start_time)}
                          <span>{clockTime(e.end_time)}</span>
                        </>
                      ) : (
                        "All day"
                      )}
                    </div>
                    <div className="db-slot-body">
                      <div className="db-slot-name">{e.title}</div>
                      {e.note && <div className="db-slot-meta">{e.note}</div>}
                      <div className="db-slot-tags">
                        {e.blocks_bookings ? (
                          <span className="badge event-block">Bookings blocked</span>
                        ) : (
                          <span className="badge">Your event</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              }
              const b = item;
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
                      {b.example && <ExampleTag />}
                      {isRegular && (
                        <span className="badge regular">
                          <RegularStar label={null} size={9} /> Regular
                        </span>
                      )}
                    </div>
                    <div className="db-slot-meta">{b.service_name}</div>
                    {photosOf[b.id] && (
                      <div className="rq-photos small">
                        {photosOf[b.id].map((u) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={u} alt="Client's reference photo" loading="lazy" />
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="db-slot-tags">
                      {standingIds.has(b.id) && <span className="badge standing">Standing</span>}
                      {missingWaiver.has(b.id) && <span className="badge unpaid">Waiver needed</span>}
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

      {/* Below the timeline; a right-hand column on wide screens (1200px and up). */}
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
          ) : exampleNext ? (
            <div className="db-next is-example">
              <p className="db-next-when">
                {shortDay(exampleNext.booking_date)} · {clockTime(exampleNext.start_time)} <ExampleTag />
              </p>
              <p className="db-next-name">{exampleNext.client_name}</p>
              <p className="muted small-text">{exampleNext.service_name}</p>
            </div>
          ) : (
            <p className="db-quiet-small">Nothing booked yet.</p>
          )}
        </section>

        {laterEvents.length > 0 && (
          <section>
            <div className="db-section-head">
              <h2>Your events this week</h2>
            </div>
            <ul className="db-open-list">
              {laterEvents.slice(0, 8).map((e) => (
                <li key={`${e.id}-${e.date}`}>
                  <span>{shortDay(e.date)}</span>
                  <span className="db-event-side">
                    {e.start_time ? `${clockTime(e.start_time)} ` : ""}
                    {e.title}
                    {e.blocks_bookings && <span className="db-event-dot" aria-label="Bookings blocked" />}
                  </span>
                </li>
              ))}
            </ul>
            <p className="db-side-link">
              <Link href="/dashboard/bookings">Open Calendar</Link>
            </p>
          </section>
        )}

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

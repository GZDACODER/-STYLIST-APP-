// Insights: revenue, visits, no-shows, Regulars vs new clients and deposits
// for a period (this month by default), compared with the
// period before. Worked out from the bookings already stored; see lib/reports.js.
import PageHeader from "@/components/dash/PageHeader";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/availability";
import { nowLocal } from "@/lib/localTime";
import { BRAND_NAME } from "@/lib/brand";
import { PERIODS, addDays, daysBetween, periodRange, revenueSeries, summarize } from "@/lib/reports";
import ReportsView from "./ReportsView";
import { insights } from "@/lib/insights";
import { getMyTemplate } from "@/lib/templates/server";
import { exampleReportData, examplesOn, sample } from "@/lib/examples";

export const metadata = { title: `Insights · ${BRAND_NAME}` };

const COLUMNS =
  "id, booking_date, start_time, status, price_cents, deposit_cents, deposit_status, deposit_paid_at, outcome, client_id";

export default async function ReportsPage({ searchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: stylist } = await supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle();
  if (!stylist) redirect("/dashboard");

  const tz = stylist.timezone;
  const today = todayInTimeZone(tz);
  const now = nowLocal(tz);
  const { period: asked, tab: askedTab } = await searchParams;
  const tab = ["revenue", "clients", "schedule"].includes(askedTab) ? askedTab : "revenue";
  const period = PERIODS.some((p) => p.value === asked) ? asked : "this_month";
  const range = periodRange(period, today);

  // Bookings in this period and the one before, plus any whose deposit was
  // paid in that time (a deposit can be paid weeks before the visit).
  // With step 24 / 25 columns when those SQL files have been run.
  const load = (cols, filter) => filter(supabase.from("bookings").select(cols));
  const byDate = (q) => q.gte("booking_date", range.prevFrom).lte("booking_date", range.to).limit(5000);
  const byPaid = (q) =>
    q
      .gte("deposit_paid_at", `${range.prevFrom}T00:00:00Z`)
      .lte("deposit_paid_at", `${range.to}T23:59:59Z`)
      .limit(5000);
  const extras = ["owed_cents, reschedule_count", "owed_cents", ""];
  let rows = null;
  let paidRows = [];
  let loadError = null;
  for (const extra of extras) {
    const cols = extra ? `${COLUMNS}, ${extra}` : COLUMNS;
    const [a, b] = await Promise.all([load(cols, byDate), load(cols, byPaid)]);
    if (!a.error) {
      rows = a.data || [];
      paidRows = b.data || [];
      loadError = null;
      break;
    }
    loadError = a.error;
  }
  if (rows === null) {
    return (
      <>
        <PageHeader title="Insights" />
        <p className="message error">Couldn&apos;t load your bookings: {loadError?.message}</p>
      </>
    );
  }

  let { data: clientRows } = await supabase.from("clients").select("id, status, created_at, name");

  // A new pro with no bookings or clients yet: an example report, worked out
  // by the same code from a sample book of visits (never saved).
  let example = false;
  if (!rows.length && !paidRows.length && !(clientRows || []).length && (await examplesOn(supabase, user.id))) {
    const ex = exampleReportData(range.prevFrom, range.to, today);
    rows = ex.bookings;
    clientRows = ex.clients;
    example = true;
  }

  const localDay = (iso) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso)) : null);
  const merged = new Map();
  for (const b of [...rows, ...paidRows]) merged.set(b.id, { ...b, deposit_paid_at: localDay(b.deposit_paid_at) });
  const bookings = [...merged.values()];

  const regularIds = new Set((clientRows || []).filter((c) => c.status === "regular").map((c) => c.id));
  const clientsCreated = (clientRows || []).map((c) => localDay(c.created_at));
  // A period still going (this month, this year) is compared with the same
  // number of days of the period before: Nov 1–16 vs Oct 1–16.
  const inProgress = range.to > today;
  const prevCut = inProgress ? addDays(range.prevFrom, daysBetween(range.from, today)) : range.prevTo;
  const prevTo = prevCut < range.prevTo ? prevCut : range.prevTo;
  const thisPeriod = summarize({ bookings, regularIds, clientsCreated, from: range.from, to: range.to, now });
  const before = summarize({ bookings, regularIds, clientsCreated, from: range.prevFrom, to: prevTo, now });
  if (inProgress) range.compare = `the same days ${range.compare}`;
  const series = revenueSeries({ bookings, regularIds, from: range.from, to: range.to, kind: range.buckets, now });

  // Top regulars this period: visits that went ahead, then what they spent.
  const names = new Map((clientRows || []).map((c) => [c.id, c.name]));
  const tally = new Map();
  for (const b of bookings) {
    if (b.booking_date < range.from || b.booking_date > range.to || b.status !== "confirmed") continue;
    if (!regularIds.has(b.client_id) || b.outcome === "no_show") continue;
    if (`${b.booking_date}T${String(b.start_time).slice(0, 5)}` > now) continue;
    const t = tally.get(b.client_id) || { name: names.get(b.client_id) || "A regular", visits: 0, cents: 0 };
    t.visits += 1;
    t.cents += b.price_cents || 0;
    tally.set(b.client_id, t);
  }
  // Client feedback this period (step 46 SQL): the average and recent ones.
  let feedbackRows = [];
  if (example) {
    // Sample reviews that match the pro's trade (lib/templates samples).
    const tpl = await getMyTemplate();
    // Reviews go on paid services (not a free consultation).
    const svc = (tpl.presets.services || []).filter((x) => x.price_cents > 0).map((x) => x.name);
    feedbackRows = sample(tpl).reviews.slice(0, 3).map((r, i) => ({
      rating: r.rating,
      comment: i === 1 ? "" : r.comment,
      created_at: `${range.from}T15:00:00Z`,
      booking: { client_name: r.name, service_name: svc[i % Math.max(1, svc.length)] || "Appointment" },
    }));
  } else {
    const { data: fb, error: fbError } = await supabase
      .from("visit_feedback")
      .select("rating, comment, created_at, booking:bookings(client_name, service_name, booking_date)")
      .gte("created_at", `${range.from}T00:00:00Z`)
      .lte("created_at", `${range.to}T23:59:59Z`)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!fbError) feedbackRows = fb || [];
  }
  const feedback = {
    count: feedbackRows.length,
    average: feedbackRows.length ? feedbackRows.reduce((a, f) => a + f.rating, 0) / feedbackRows.length : null,
    recent: feedbackRows.slice(0, 8),
  };

  const topRegulars = [...tally.values()].sort((a, b) => b.visits - a.visits || b.cents - a.cents).slice(0, 5);

  // Insights (step 63 SQL): about a year of bookings plus what's booked ahead.
  let insightData = null;
  if (!example) {
    const back = addDays(today, -400) < range.prevFrom ? addDays(today, -400) : range.prevFrom;
    const [{ data: all, error: allError }, { data: pays }, { data: hours }, { data: inv }] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, client_id, client_name, client_email, service_id, service_name, booking_date, start_time, status, outcome, price_cents, cancelled_at")
        .gte("booking_date", back)
        .lte("booking_date", addDays(today, 120))
        .limit(10000),
      supabase.from("payments").select("kind, amount_cents, paid_on").gte("paid_on", range.from).lte("paid_on", range.to).limit(5000),
      supabase.from("working_hours").select("weekday, is_working, start_time, end_time"),
      supabase.from("clients").select("id, email, invited_back_at"),
    ]);
    if (!allError) {
      const toLocal = (iso) => (iso ? new Intl.DateTimeFormat("sv-SE", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)).replace(" ", "T") : null);
      const workingCells = new Set();
      for (const h of hours || []) {
        if (!h.is_working || !h.start_time || !h.end_time) continue;
        const d = (h.weekday + 6) % 7;
        if (h.start_time < "12:00") workingCells.add(`${d}-0`);
        if (h.start_time < "17:00" && h.end_time > "12:00") workingCells.add(`${d}-1`);
        if (h.end_time > "17:00") workingCells.add(`${d}-2`);
      }
      insightData = {
        x: insights({
          bookings: (all || []).map((b) => ({ ...b, cancelled_local: toLocal(b.cancelled_at) })),
          payments: pays || [],
          range: { ...range, prevTo },
          now,
          today,
          workingCells,
        }),
        invitedRecently: new Set((inv || []).filter((c) => c.invited_back_at && Date.now() - new Date(c.invited_back_at).getTime() < 30 * 86400000).map((c) => c.id)),
        emailOf: Object.fromEntries((inv || []).filter((c) => c.email).map((c) => [c.id, true])),
      };
    }
  }

  return (
    <ReportsView
      tab={tab}
      insight={insightData}
      period={period}
      range={range}
      today={today}
      s={thisPeriod}
      before={before}
      series={series}
      topRegulars={topRegulars}
      feedback={feedback}
      example={example}
    />
  );
}

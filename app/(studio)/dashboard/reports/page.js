// Reports: revenue, visits, no-shows, Regulars vs new clients, deposits and
// balances owed, for a period (this month by default), compared with the
// period before. Worked out from the bookings already stored; see lib/reports.js.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/availability";
import { nowLocal } from "@/lib/localTime";
import { BRAND_NAME } from "@/lib/brand";
import { PERIODS, addDays, daysBetween, owedTotals, periodRange, revenueSeries, summarize } from "@/lib/reports";
import ReportsView from "./ReportsView";

export const metadata = { title: `Reports · ${BRAND_NAME}` };

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
  const { period: asked } = await searchParams;
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
      <section className="card">
        <h2>Reports</h2>
        <p className="message error">Couldn&apos;t load your bookings: {loadError?.message}</p>
      </section>
    );
  }

  const [{ data: clientRows }, { data: owedRows }] = await Promise.all([
    supabase.from("clients").select("id, status, created_at"),
    supabase
      .from("bookings")
      .select("id, status, outcome, price_cents, deposit_cents, deposit_status")
      .eq("status", "confirmed")
      .eq("outcome", "completed_owed")
      .limit(2000),
  ]);

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
  // A balance owed with an amount written down (step 24) uses it.
  const owedFull = new Map(bookings.filter((b) => b.outcome === "completed_owed").map((b) => [b.id, b]));
  const owed = owedTotals((owedRows || []).map((b) => owedFull.get(b.id) || b));

  return (
    <ReportsView
      period={period}
      range={range}
      today={today}
      s={thisPeriod}
      before={before}
      series={series}
      owed={owed}
    />
  );
}

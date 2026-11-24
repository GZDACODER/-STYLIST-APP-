// Loads what the Money tab and its exports need (step 62 SQL). Server only.
import { todayInTimeZone } from "@/lib/availability";
import { nowLocal } from "@/lib/localTime";
import { earnings, moneyPeriod, owedOn, VIEWS } from "@/lib/moneyTab";

const BOOKING_COLS =
  "id, booking_date, start_time, status, outcome, price_cents, deposit_cents, deposit_status, deposit_paid_at, owed_cents, client_id, client_name, client_email, service_name, balance_reminded_at";

export async function loadMoney(supabase, userId, { view: askedView, date: askedDate }) {
  const { data: s } = await supabase.from("stylists").select("timezone, business_name, stripe_account_id, stripe_charges_enabled").eq("id", userId).maybeSingle();
  const tz = s?.timezone || "America/Chicago";
  const today = todayInTimeZone(tz);
  const now = nowLocal(tz);
  const view = VIEWS.some(([k]) => k === askedView) ? askedView : "month";
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(String(askedDate || "")) ? askedDate : today;
  const period = moneyPeriod(view, anchor);

  const [visits, paidEarly, pays, owedRows] = await Promise.all([
    supabase.from("bookings").select(BOOKING_COLS).gte("booking_date", period.from).lte("booking_date", period.to).limit(5000),
    supabase
      .from("bookings")
      .select(BOOKING_COLS)
      .gte("deposit_paid_at", `${addDay(period.from, -1)}T00:00:00Z`)
      .lte("deposit_paid_at", `${addDay(period.to, 1)}T23:59:59Z`)
      .limit(5000),
    supabase.from("payments").select("id, booking_id, client_name, kind, method, amount_cents, paid_on, note, created_at").gte("paid_on", period.from).lte("paid_on", period.to).order("paid_on", { ascending: false }).order("created_at", { ascending: false }).limit(2000),
    supabase.from("bookings").select(BOOKING_COLS).eq("status", "confirmed").eq("outcome", "completed_owed").order("booking_date", { ascending: false }).limit(500),
  ]);
  const error = visits.error || pays.error;
  const localDay = (iso) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso)) : null);
  const merged = new Map();
  for (const b of [...(visits.data || []), ...(paidEarly.data || [])]) merged.set(b.id, { ...b, deposit_paid_at: localDay(b.deposit_paid_at) });
  const bookings = [...merged.values()];
  const payments = pays.data || [];
  const totals = earnings({ bookings, payments, period, now });

  // Balances: what's still owed after balance payments.
  const owedList = owedRows.data || [];
  let paidByBooking = new Map();
  if (owedList.length) {
    const { data: bal } = await supabase.from("payments").select("booking_id, amount_cents").eq("kind", "balance").in("booking_id", owedList.map((b) => b.id));
    for (const p of bal || []) paidByBooking.set(p.booking_id, (paidByBooking.get(p.booking_id) || 0) + p.amount_cents);
  }
  const balances = owedList.map((b) => ({ ...b, owedNow: owedOn(b, paidByBooking) })).filter((b) => b.owedNow > 0);

  const visitRows = bookings
    .filter((b) => b.booking_date >= period.from && b.booking_date <= period.to && b.status === "confirmed" && b.outcome !== "no_show" && b.outcome !== "replaced" && `${b.booking_date}T${String(b.start_time).slice(0, 5)}` <= now)
    .sort((a, b) => (a.booking_date + a.start_time).localeCompare(b.booking_date + b.start_time));

  return { stylist: s, tz, today, now, view, period, totals, payments, balances, visitRows, error };
}

function addDay(t, n) {
  const d = new Date(`${t}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

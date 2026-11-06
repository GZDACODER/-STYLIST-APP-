"use server";

// A client's history for their card: past and upcoming visits,
// cancellations, total spent and their last visit. Read only.
import { createClient } from "@/lib/supabase/server";

const nowLocal = (timeZone) =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date())
    .replace(" ", "T");

export async function getClientHistory(clientId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  // The database's security rules only return this business's own bookings.
  const columns =
    "id, booking_date, start_time, end_time, service_name, price_cents, status, deposit_cents, deposit_status";
  const load = (cols) =>
    supabase
      .from("bookings")
      .select(cols)
      .eq("client_id", String(clientId))
      .in("status", ["confirmed", "cancelled"])
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(300);

  const { data: stylist } = await supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle();
  // With how each visit went (step 18 SQL); without it before that's run.
  let { data: bookings, error } = await load(`${columns}, outcome`);
  if (error) ({ data: bookings, error } = await load(columns));
  if (error) return { error: `Couldn't load their history: ${error.message}` };

  const now = nowLocal(stylist?.timezone || "America/Chicago");
  const at = (b, time) => `${b.booking_date}T${String(time).slice(0, 5)}`;

  const past = [];
  const upcoming = [];
  let cancelled = 0;
  let noShows = 0;
  let replaced = 0;
  let owed = 0;
  let spentCents = 0;
  let visits = 0;
  let lastVisit = null;
  let depositsKeptCents = 0;
  for (const b of bookings || []) {
    if (b.status === "cancelled") {
      cancelled += 1;
      // A paid deposit on a cancelled visit is money the business kept.
      if (b.deposit_status === "paid") depositsKeptCents += b.deposit_cents || 0;
      continue;
    }
    if (at(b, b.end_time) <= now) {
      past.push(b);
      // A no-show, or a visit someone else took, isn't one of their visits.
      if (b.outcome === "no_show") noShows += 1;
      else if (b.outcome === "replaced") replaced += 1;
      else {
        visits += 1;
        spentCents += b.price_cents || 0;
        if (b.outcome === "completed_owed") owed += 1;
        lastVisit ??= b;
      }
    } else {
      upcoming.push(b);
    }
  }
  upcoming.reverse();

  return {
    visits,
    cancelled,
    noShows,
    replaced,
    owed,
    spentCents,
    depositsKeptCents,
    lastVisit,
    upcoming: upcoming.slice(0, 5),
    upcomingCount: upcoming.length,
    recent: past.slice(0, 8),
    recentCancelled: (bookings || []).filter((b) => b.status === "cancelled").slice(0, 3),
  };
}

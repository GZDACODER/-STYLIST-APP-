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
  const [{ data: stylist }, { data: bookings, error }] = await Promise.all([
    supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle(),
    supabase
      .from("bookings")
      .select("id, booking_date, start_time, end_time, service_name, price_cents, status, deposit_cents, deposit_status")
      .eq("client_id", String(clientId))
      .in("status", ["confirmed", "cancelled"])
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(300),
  ]);
  if (error) return { error: `Couldn't load their history: ${error.message}` };

  const now = nowLocal(stylist?.timezone || "America/Chicago");
  const at = (b, time) => `${b.booking_date}T${String(time).slice(0, 5)}`;

  const past = [];
  const upcoming = [];
  let cancelled = 0;
  let spentCents = 0;
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
      spentCents += b.price_cents || 0;
    } else {
      upcoming.push(b);
    }
  }
  upcoming.reverse();

  return {
    visits: past.length,
    cancelled,
    spentCents,
    depositsKeptCents,
    lastVisit: past[0] || null,
    upcoming: upcoming.slice(0, 5),
    upcomingCount: upcoming.length,
    recent: past.slice(0, 8),
    recentCancelled: (bookings || []).filter((b) => b.status === "cancelled").slice(0, 3),
  };
}

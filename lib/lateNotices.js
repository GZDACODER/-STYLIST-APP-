// "Running late" notices from clients (step 46 SQL): the last 6 hours, not
// yet dismissed, newest first. Empty before the SQL is run.
export async function recentLateNotices(supabase) {
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("late_notices")
    .select("id, minutes, created_at, booking:bookings(client_name, service_name, start_time)")
    .is("seen_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);
  return error ? [] : data || [];
}

export const lateText = (n) =>
  `${n.booking?.client_name || "A client"} is running ${n.minutes >= 15 ? "15+" : n.minutes} min late`;

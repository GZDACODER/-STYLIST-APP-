// Past visits for the Calendar's month view, for a range of dates. The
// Calendar loads the last two months straight away and older months only
// when the pro goes back to them (see CalendarView and loadOlderBookings).
// Server code only.

const PAST_COLUMNS =
  "id, booking_date, start_time, end_time, service_name, price_cents, client_name, client_email, client_phone, status, deposit_cents, deposit_status, client:clients(status, invited_at)";

// The first day of the month before `today` ("2026-11-19" -> "2026-10-01").
export function calendarWindowStart(today) {
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
}

// Confirmed visits with from <= date < to, each with `past` and, if the
// client moved it, `moved` ({ count, originally }).
export async function loadPastBookings(supabase, from, to, timeZone) {
  const load = (cols) =>
    supabase
      .from("bookings")
      .select(cols)
      .eq("status", "confirmed")
      .gte("booking_date", from)
      .lt("booking_date", to)
      .order("booking_date")
      .order("start_time")
      .limit(3000);
  const movedQuery = Promise.resolve(
    supabase
      .from("bookings")
      .select("id, reschedule_count, original_start_at")
      .gte("booking_date", from)
      .lt("booking_date", to)
      .gt("reschedule_count", 0)
  );

  // Each column set on its own, so the Calendar still opens before the
  // step 18 and 24 SQL is run.
  let { data: rows, error } = await load(`${PAST_COLUMNS}, outcome, visit_note, owed_cents`);
  if (error) ({ data: rows, error } = await load(`${PAST_COLUMNS}, outcome`));
  if (error) ({ data: rows } = await load(PAST_COLUMNS));

  const { data: movedRows } = await movedQuery;
  const moved = movedText(movedRows, timeZone);
  return (rows || []).map((b) => ({ ...b, past: true, moved: moved.get(b.id) }));
}

// Bookings a client moved themselves: how many times, and the original time
// in the business's time zone.
export function movedText(rows, timeZone) {
  return new Map(
    (rows || []).map((r) => {
      const when = r.original_start_at
        ? new Date(r.original_start_at).toLocaleString("en-US", {
            timeZone,
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : null;
      return [r.id, { count: r.reschedule_count, originally: when }];
    })
  );
}

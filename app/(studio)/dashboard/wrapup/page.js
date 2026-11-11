// Wrap up visits: how did each finished visit go? Linked from the 8 PM
// email and from the Today page. Shows the last 14 days.
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { clockTime, formatDate, todayInTimeZone } from "@/lib/availability";
import { formatPrice } from "@/lib/money";
import { BRAND_NAME } from "@/lib/brand";
import OutcomePicker from "./OutcomePicker";
import VisitNoteForm from "../notes/VisitNoteForm";

export const metadata = { title: `Wrap up visits · ${BRAND_NAME}` };

function nowLocal(timeZone) {
  return new Intl.DateTimeFormat("sv-SE", {
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
}

function daysBefore(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

function deposit(b) {
  if (!b.deposit_cents) return "";
  if (b.deposit_status === "paid") return ` · ${formatPrice(b.deposit_cents)} deposit paid`;
  if (b.deposit_status === "unpaid") return ` · ${formatPrice(b.deposit_cents)} deposit unpaid`;
  return "";
}

export default async function WrapupPage() {
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

  // With visit notes (step 24 SQL); without them until that's run.
  const COLUMNS =
    "id, booking_date, start_time, end_time, client_name, service_name, price_cents, deposit_cents, deposit_status, outcome";
  let notesReady = true;
  const loadRecent = (cols) =>
    supabase
      .from("bookings")
      .select(cols)
      .eq("status", "confirmed")
      .gte("booking_date", daysBefore(today, 13))
      .lte("booking_date", today)
      .order("booking_date", { ascending: false })
      .order("start_time");
  let { data: rows, error } = await loadRecent(`${COLUMNS}, visit_note, owed_cents`);
  if (error) {
    notesReady = false;
    ({ data: rows, error } = await loadRecent(COLUMNS));
  }

  if (error) {
    return (
      <section className="card">
        <h2>Wrap up visits</h2>
        <p className="message error">
          {/outcome/.test(error.message)
            ? "Run the step 18 SQL (0023_visit_outcomes.sql) in Supabase first."
            : `Couldn't load your visits: ${error.message}`}
        </p>
      </section>
    );
  }

  // Balances still owed, from any date (cleared by marking them paid in full).
  const { data: owedRows } = await supabase
    .from("bookings")
    .select(notesReady ? `${COLUMNS}, visit_note, owed_cents` : COLUMNS)
    .eq("status", "confirmed")
    .eq("outcome", "completed_owed")
    .order("booking_date", { ascending: false })
    .limit(100);
  const owed = owedRows || [];
  const owedIds = new Set(owed.map((b) => b.id));

  // Only visits that have started.
  const started = (rows || []).filter((b) => `${b.booking_date}T${b.start_time.slice(0, 5)}` <= now);
  const toMark = started.filter((b) => !b.outcome);
  const marked = started.filter((b) => b.outcome && !owedIds.has(b.id));

  const byDay = (list) => {
    const days = [];
    for (const b of list) {
      const last = days[days.length - 1];
      if (last && last.date === b.booking_date) last.visits.push(b);
      else days.push({ date: b.booking_date, visits: [b] });
    }
    return days;
  };

  const Visit = ({ b }) => (
    <li className="client-card wrapup-visit">
      <div className="client-top">
        <span className="opening-time">
          {clockTime(b.start_time)} – {clockTime(b.end_time)}
        </span>
      </div>
      <div className="client-name">{b.client_name}</div>
      <div className="muted small-text">
        {b.service_name} · {formatPrice(b.price_cents)}
        {deposit(b)}
      </div>
      <OutcomePicker bookingId={b.id} outcome={b.outcome} clientName={b.client_name} />
      {notesReady && (
        <VisitNoteForm
          bookingId={b.id}
          note={b.visit_note}
          owedCents={b.owed_cents}
          owed={b.outcome === "completed_owed"}
        />
      )}
    </li>
  );

  return (
    <>
      <section className="card">
        <h2>Wrap up visits</h2>
        <p className="muted small-text">
          How did each visit go? No-shows and balances owed show on the client&apos;s History and
          your Today page. Nothing is charged or refunded automatically. ·{" "}
          <Link href="/dashboard">Back to Today</Link>
        </p>

        {toMark.length === 0 && <p className="db-quiet">All caught up. Nothing to wrap up.</p>}

        <ul className="day-list">
          {byDay(toMark).map((day) => (
            <li key={day.date} className="day-group">
              <div className="day-heading">
                <strong>{day.date === today ? `Today · ${formatDate(day.date)}` : formatDate(day.date)}</strong>
              </div>
              <ul className="client-list">
                {day.visits.map((b) => (
                  <Visit key={b.id} b={b} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {owed.length > 0 && (
        <section className="card" id="owed">
          <h2>Balances owed ({owed.length})</h2>
          <p className="muted small-text">
            Once they&apos;ve paid, tap <strong>Completed, paid in full</strong>.
          </p>
          <ul className="client-list">
            {owed.map((b) => (
              <Visit key={b.id} b={b} />
            ))}
          </ul>
        </section>
      )}

      {marked.length > 0 && (
        <section className="card">
          <details>
            <summary>
              <h2>Already marked ({marked.length})</h2>
            </summary>
            <p className="muted small-text">Tap a different choice to change it, or the same one to clear it.</p>
            <ul className="day-list">
              {byDay(marked).map((day) => (
                <li key={day.date} className="day-group">
                  <div className="day-heading">
                    <strong>{formatDate(day.date)}</strong>
                  </div>
                  <ul className="client-list">
                    {day.visits.map((b) => (
                      <Visit key={b.id} b={b} />
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </>
  );
}

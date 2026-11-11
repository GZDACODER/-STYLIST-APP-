// Notes: what happened at each visit, gathered in one place. By client (the
// default) or by day: how each visit went, notes, no-shows and balances owed.
// Notes and amounts are written here or on Wrap up visits.
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { todayInTimeZone } from "@/lib/availability";
import { nowLocal } from "@/lib/localTime";
import { BRAND_NAME } from "@/lib/brand";
import NotesView from "./NotesView";

export const metadata = { title: `Notes · ${BRAND_NAME}` };

function daysBefore(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}

export default async function NotesPage() {
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

  // Confirmed visits from the last 12 months that have started.
  const [{ data: rows, error }, { data: clientRows }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, booking_date, start_time, end_time, client_id, client_name, service_name, price_cents, deposit_cents, deposit_status, outcome, visit_note, owed_cents"
      )
      .eq("status", "confirmed")
      .gte("booking_date", daysBefore(today, 365))
      .lte("booking_date", today)
      .order("booking_date", { ascending: false })
      .order("start_time", { ascending: false })
      .limit(2000),
    supabase.from("clients").select("id, name, status, notes"),
  ]);

  if (error) {
    return (
      <section className="card">
        <h2>Notes</h2>
        <p className="message error">
          {/visit_note|owed_cents|outcome/.test(error.message)
            ? "Notes aren't set up yet: run the step 24 SQL (0029_visit_notes.sql) in Supabase, then refresh."
            : `Couldn't load your visits: ${error.message}`}
        </p>
      </section>
    );
  }

  const clientsById = new Map((clientRows || []).map((c) => [c.id, c]));
  const visits = (rows || [])
    .filter((b) => `${b.booking_date}T${String(b.start_time).slice(0, 5)}` <= now)
    .map((b) => {
      const card = b.client_id ? clientsById.get(b.client_id) : null;
      return {
        id: b.id,
        date: b.booking_date,
        start: String(b.start_time).slice(0, 5),
        end: String(b.end_time).slice(0, 5),
        // Visits whose client card was deleted are grouped by name.
        clientKey: card ? card.id : `name:${String(b.client_name).trim().toLowerCase()}`,
        clientName: card?.name || b.client_name,
        status: card?.status || null,
        service: b.service_name,
        priceCents: b.price_cents,
        depositCents: b.deposit_status === "paid" ? b.deposit_cents || 0 : 0,
        outcome: b.outcome,
        note: b.visit_note,
        owedCents: b.owed_cents,
      };
    });

  // The general notes from each client's card, shown at the top of their notes.
  const cardNotes = {};
  for (const c of clientRows || []) if (c.notes) cardNotes[c.id] = c.notes;

  return (
    <section className="card">
      <h2>Notes</h2>
      <p className="muted small-text">
        How each visit went, your notes, no-shows and balances owed from the last 12 months. Write
        notes here or on Wrap up visits.
      </p>
      <NotesView visits={visits} cardNotes={cardNotes} today={today} />
    </section>
  );
}

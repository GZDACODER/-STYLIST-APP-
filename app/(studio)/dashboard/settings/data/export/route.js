// Settings > Your data: download your clients, bookings or payments as a
// spreadsheet (CSV). Only the logged-in pro's own rows (row security).
import { createClient } from "@/lib/supabase/server";

const cell = (v) => {
  const s = String(v ?? "");
  const safe = /^(=|@|[+-](?![0-9 ().]+$))/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const dollars = (c) => (c == null ? "" : (c / 100).toFixed(2));

const KINDS = {
  clients: {
    table: "clients",
    cols: "name, email, phone, status, birthday, notes, created_at",
    head: ["Name", "Email", "Phone", "Status", "Birthday", "Notes", "Added"],
    row: (r) => [r.name, r.email, r.phone, r.status, r.birthday, r.notes, r.created_at?.slice(0, 10)],
    order: "name",
  },
  bookings: {
    table: "bookings",
    cols: "booking_date, start_time, end_time, client_name, client_email, client_phone, service_name, price_cents, deposit_cents, deposit_status, status, outcome, owed_cents, visit_note",
    head: ["Date", "Start", "End", "Client", "Email", "Phone", "Service", "Price", "Deposit", "Deposit status", "Status", "Outcome", "Owed", "Visit note"],
    row: (r) => [r.booking_date, String(r.start_time).slice(0, 5), String(r.end_time).slice(0, 5), r.client_name, r.client_email, r.client_phone, r.service_name, dollars(r.price_cents), dollars(r.deposit_cents), r.deposit_status, r.status, r.outcome, dollars(r.owed_cents), r.visit_note],
    order: "booking_date",
  },
  payments: {
    table: "payments",
    cols: "paid_on, client_name, kind, method, amount_cents, note",
    head: ["Date", "Client", "For", "Paid by", "Amount", "Note"],
    row: (r) => [r.paid_on, r.client_name, r.kind, r.method, dollars(r.amount_cents), r.note],
    order: "paid_on",
  },
};

export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Please log in.", { status: 401 });
  const what = new URL(request.url).searchParams.get("what");
  const k = KINDS[what];
  if (!k) return new Response("Not found", { status: 404 });
  const rows = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await supabase.from(k.table).select(k.cols).order(k.order).range(from, from + 999);
    if (error) return new Response("Couldn't load your data.", { status: 500 });
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  const body = "﻿" + [k.head, ...rows.map(k.row)].map((l) => l.map(cell).join(",")).join("\r\n") + "\r\n";
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientele-${what}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

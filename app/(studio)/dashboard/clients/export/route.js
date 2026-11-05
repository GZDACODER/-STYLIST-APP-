// "Export clients" on the Clients tab: downloads the stylist's client list
// as a CSV file (opens in Excel, Numbers or Google Sheets). The columns match
// what "Import clients" reads, so the file can be imported again.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { displayPhone } from "@/lib/phone";

const STATUS_LABELS = { regular: "Regular", new: "New", blocked: "Blocked" };

// One CSV cell. Text a spreadsheet would run as a formula (=, @, or + / -
// that isn't a phone number) gets a leading apostrophe.
function cell(value) {
  let text = String(value ?? "");
  if (/^[=@\t\r]/.test(text) || (/^[+-]/.test(text) && !/^[+\-\d\s().]+$/.test(text))) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function GET(request) {
  const origin = new URL(request.url).origin;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const [{ data: clients, error }, { data: stylist }] = await Promise.all([
    supabase
      .from("clients")
      .select("name, phone, email, status, completed_visits, notes, created_at")
      .eq("stylist_id", user.id)
      .order("name", { ascending: true }),
    supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle(),
  ]);
  if (error) return new Response(`Couldn't load your clients: ${error.message}`, { status: 500 });

  const tz = stylist?.timezone || "America/Chicago";
  const day = (iso) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(iso)) : "");

  const lines = [
    ["Name", "Phone", "Email", "Status", "Visits", "Notes", "Added"].join(","),
    ...(clients || []).map((c) =>
      [
        c.name,
        displayPhone(c.phone),
        c.email,
        STATUS_LABELS[c.status] || c.status,
        c.completed_visits ?? 0,
        c.notes,
        day(c.created_at),
      ]
        .map(cell)
        .join(",")
    ),
  ];

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  const filename = `clients-${today}.csv`;
  // The BOM makes Excel read names with accents correctly.
  return new Response(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

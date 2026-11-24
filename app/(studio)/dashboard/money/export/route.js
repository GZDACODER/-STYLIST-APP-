// Money exports for the period on screen: a spreadsheet (CSV) of every
// visit and recorded payment, or a one-page-plus summary (PDF).
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { loadMoney } from "@/lib/moneyData";
import { KIND_LABEL, METHOD_LABEL } from "@/lib/moneyTab";
import { formatPrice } from "@/lib/money";

const csvCell = (v) => {
  const s = String(v ?? "");
  // Leading = + - @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
const dollars = (c) => (c / 100).toFixed(2);
const clean = (s) => String(s ?? "").replace(/·/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/[^\x20-\x7E]/g, "");

function entries(m) {
  const rows = [
    ...m.visitRows.map((b) => ({ date: b.booking_date, type: "Service", client: b.client_name, detail: b.service_name, method: b.deposit_status === "paid" && b.deposit_cents ? `Deposit online ${dollars(b.deposit_cents)}` : "", cents: b.price_cents || 0 })),
    ...m.payments.map((p) => ({ date: p.paid_on, type: KIND_LABEL[p.kind], client: p.client_name || "", detail: p.note || "", method: METHOD_LABEL[p.method], cents: p.amount_cents })),
  ];
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Please log in.", { status: 401 });
  const url = new URL(request.url);
  const m = await loadMoney(supabase, user.id, { view: url.searchParams.get("view"), date: url.searchParams.get("date") });
  const name = `clientele-money-${m.period.from}-to-${m.period.to}`;
  const list = entries(m);

  if (url.searchParams.get("format") === "csv") {
    const lines = [["Date", "Type", "Client", "Service or note", "Paid by", "Amount", "Counts toward earnings"]];
    for (const r of list) lines.push([r.date, r.type, r.client, r.detail, r.method, dollars(r.cents), r.type === "Balance paid" ? "No (visit already counted)" : "Yes"]);
    const body = "﻿" + lines.map((l) => l.map(csvCell).join(",")).join("\r\n") + "\r\n";
    return new Response(body, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "no-store" },
    });
  }

  // PDF summary.
  const t = m.totals;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const INK = rgb(0.07, 0.06, 0.05);
  const MUTED = rgb(0.42, 0.4, 0.36);
  const GOLD = rgb(0.66, 0.53, 0.3);
  const W = 612;
  const H = 792;
  const M = 56;
  let page = pdf.addPage([W, H]);
  let y = H - M;
  const line = (text, { size = 10.5, f = font, color = INK, x = M } = {}) => {
    if (y < M + 20) {
      page = pdf.addPage([W, H]);
      y = H - M;
    }
    page.drawText(clean(text), { x, y, size, font: f, color });
  };
  const row = (left, right, opts = {}) => {
    line(left, opts);
    const r = clean(right);
    page.drawText(r, { x: W - M - (opts.f || font).widthOfTextAtSize(r, opts.size || 10.5), y, size: opts.size || 10.5, font: opts.f || font, color: INK });
    y -= (opts.size || 10.5) + 7;
  };
  page.drawRectangle({ x: M, y: y - 2, width: 28, height: 1, color: GOLD });
  y -= 24;
  line("Money summary", { size: 24, f: serif });
  y -= 18;
  line(`${m.stylist?.business_name || ""} · ${m.period.label}`, { color: MUTED });
  y -= 30;
  row("Earned", formatPrice(t.totalCents), { size: 16, f: bold });
  y -= 4;
  row(`Services (${t.visits} ${t.visits === 1 ? "visit" : "visits"})`, formatPrice(t.servicesCents));
  row("Tips", formatPrice(t.tipsCents));
  row("Product sales", formatPrice(t.productCents));
  row("Other income", formatPrice(t.otherCents));
  y -= 6;
  row("Deposits paid online (part of services)", formatPrice(t.depositsCents), { color: MUTED });
  row("Balances paid off (not new income)", formatPrice(t.balancesCents), { color: MUTED });
  const methods = Object.entries(t.byMethod);
  if (methods.length) {
    y -= 12;
    line("How you were paid (recorded payments and online deposits)", { f: bold, size: 10 });
    y -= 17;
    for (const [k, c] of methods) row(k === "stripe" ? "Online deposits (Stripe)" : METHOD_LABEL[k], formatPrice(c));
  }
  if (m.balances.length) {
    y -= 12;
    row("Still owed to you (all dates)", formatPrice(m.balances.reduce((a, b) => a + b.owedNow, 0)), { f: bold, size: 10 });
  }
  y -= 16;
  line("Every entry", { f: bold, size: 10 });
  y -= 17;
  for (const r of list) row(`${r.date}  ${r.type}  ${r.client}${r.detail ? ` - ${r.detail}` : ""}`.slice(0, 92), formatPrice(r.cents), { size: 9 });
  y -= 10;
  line("Made with Clientele. Services count visits that went ahead, at their listed price. Keep your own records for taxes.", { size: 7.5, color: MUTED });
  const bytes = await pdf.save();
  return new Response(bytes, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"`, "Cache-Control": "no-store" },
  });
}

// The end-of-day wrap-up email to the business (8 PM their time): today's
// finished visits, with a button to mark each one Completed (paid in full),
// Completed (balance owed), No-show or Someone else came. Server code only.
import { createAdminClient } from "@/lib/supabase/admin";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { stylistEmails } from "@/lib/waitlist";
import { publicSiteUrl } from "@/lib/siteUrl";
import { clockTime, formatDate } from "@/lib/availability";
import { formatPrice } from "@/lib/money";

function siteBase() {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return publicSiteUrl(production ? `https://${production}` : "");
}

function depositNote(v) {
  if (!v.deposit_cents) return "";
  if (v.deposit_status === "paid") return `${formatPrice(v.deposit_cents)} deposit paid`;
  if (v.deposit_status === "unpaid") return `${formatPrice(v.deposit_cents)} deposit unpaid`;
  return "";
}

export function wrapupEmail(row, to, base) {
  const link = `${base}/dashboard/wrapup`;
  const visits = row.visits || [];
  const count = visits.length === 1 ? "1 visit" : `${visits.length} visits`;
  const name = String(row.first_name || "").trim();
  const lines = visits.map((v) => {
    const extra = [formatPrice(v.price_cents), depositNote(v)].filter(Boolean).join(" · ");
    return { time: clockTime(v.start_time), who: v.client_name, what: v.service_name, extra };
  });

  return {
    to,
    subject: `How did today go? ${count} to wrap up`,
    html: emailLayout("How did today go?", [
      `<p>${name ? `Hi ${escapeHtml(name)},` : "Hi,"}</p>`,
      `<p>Here are today's visits at <strong>${escapeHtml(row.business_name)}</strong> (${escapeHtml(
        formatDate(row.local_date)
      )}). Mark each one so your client records and balances stay right.</p>`,
      `<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:14px;">${lines
        .map(
          (l) =>
            `<tr><td style="padding:8px 10px 8px 0;border-bottom:1px solid #eee5d3;white-space:nowrap;vertical-align:top;">${escapeHtml(
              l.time
            )}</td><td style="padding:8px 0;border-bottom:1px solid #eee5d3;"><strong>${escapeHtml(
              l.who
            )}</strong> · ${escapeHtml(l.what)}<br><span style="color:#6b655b;">${escapeHtml(
              l.extra
            )}</span></td></tr>`
        )
        .join("")}</table>`,
      `<p style="color:#6b655b;font-size:13px;">For each visit: <strong>Completed, paid in full</strong> · <strong>Completed, balance owed</strong> · <strong>No-show</strong> · <strong>Someone else came</strong>.</p>`,
      `<p>${emailButton(link, "Wrap up today's visits")}</p>`,
      `<p style="color:#6b655b;font-size:13px;">Nothing is charged or refunded automatically.</p>`,
    ]),
    text: [
      name ? `Hi ${name},` : "Hi,",
      "",
      `Here are today's visits at ${row.business_name} (${formatDate(row.local_date)}). Mark each one: Completed (paid in full), Completed (balance owed), No-show, or Someone else came.`,
      "",
      ...lines.map((l) => `${l.time}  ${l.who} · ${l.what}${l.extra ? ` (${l.extra})` : ""}`),
      "",
      `Wrap up today's visits: ${link}`,
      "",
      "Nothing is charged or refunded automatically.",
    ].join("\n"),
  };
}

// The every-minute check. Quietly does nothing before the step 18 SQL
// (0023) is run or while email isn't set up. Returns { sent }.
export async function runWrapups() {
  if (!emailConfigured() || !process.env.SUPABASE_SECRET_KEY) return { sent: 0 };
  const admin = createAdminClient();
  const { data: rows, error } = await admin.rpc("wrapup_due");
  if (error) {
    if (!/wrapup_due/.test(error.message)) console.error("wrapup_due failed", error.message);
    return { sent: 0 };
  }
  if (!rows?.length) return { sent: 0 };

  const base = siteBase();
  const emails = await stylistEmails(admin, rows.map((r) => r.stylist_id));
  const due = rows.filter((r) => emails[r.stylist_id]);
  const results = await sendEmails(due.map((r) => wrapupEmail(r, emails[r.stylist_id], base)));

  let sent = 0;
  for (const [i, r] of due.entries()) {
    if (!results[i]?.ok) {
      console.error("Wrap-up email didn't send", r.stylist_id, results[i]?.error);
      continue;
    }
    await admin.rpc("wrapup_mark", { p_stylist_id: r.stylist_id, p_date: r.local_date });
    sent += 1;
  }
  // No email address to send to: don't try again today.
  for (const r of rows.filter((r) => !emails[r.stylist_id])) {
    await admin.rpc("wrapup_mark", { p_stylist_id: r.stylist_id, p_date: r.local_date });
  }
  return { sent };
}

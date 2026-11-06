// The weekly summary email to each business (Mondays from 8 AM their time):
// last week's numbers and what's booked this week. Server code only.
import { createAdminClient } from "@/lib/supabase/admin";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { stylistEmails } from "@/lib/waitlist";
import { publicSiteUrl } from "@/lib/siteUrl";
import { parseDateString } from "@/lib/availability";
import { formatPrice } from "@/lib/money";
import { makeVisitPass } from "@/lib/visitPass";

function siteBase() {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return publicSiteUrl(production ? `https://${production}` : "");
}

const money = (cents) => formatPrice(Number(cents) || 0).replace(/\.00$/, "");
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const day = (text) =>
  parseDateString(text).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Nothing worth an email: no visits, bookings or loose ends at all.
export function summaryIsEmpty(r) {
  return (
    !r.visits && !r.no_shows && !r.replaced && !r.cancellations && !r.waitlist_fills &&
    !r.new_clients && !r.unmarked && !r.owed_count && !r.this_week
  );
}

export function weeklySummaryEmail(r, to, base) {
  const name = String(r.first_name || "").trim();
  const range = `${day(r.week_start)} – ${day(r.week_end)}`;

  // The big numbers, then smaller lines underneath.
  const tiles = [
    [String(r.visits), r.visits === 1 ? "Visit" : "Visits"],
    [money(r.booked_cents), "Booked"],
    [money(r.deposits_cents), "Deposits paid"],
    [String(r.this_week), "Booked this week"],
  ];
  const lastWeek = [
    r.no_shows ? plural(r.no_shows, "no-show", "no-shows") : null,
    r.replaced ? `${plural(r.replaced, "time", "times")} someone else came` : null,
    r.cancellations ? plural(r.cancellations, "cancellation", "cancellations") : null,
    r.waitlist_fills ? `${plural(r.waitlist_fills, "time", "times")} filled from your waitlist` : null,
    r.new_clients ? `${plural(r.new_clients, "new client", "new clients")}` : null,
  ].filter(Boolean);
  const thisWeek = [
    r.this_week
      ? `${plural(r.this_week, "appointment", "appointments")} booked, worth ${money(r.this_week_cents)}`
      : "Nothing booked yet",
    r.this_week_unpaid ? `${plural(r.this_week_unpaid, "deposit", "deposits")} still unpaid` : null,
  ].filter(Boolean);
  const todo = [
    r.unmarked ? `${plural(r.unmarked, "visit", "visits")} to wrap up` : null,
    r.owed_count
      ? `${plural(r.owed_count, "balance", "balances")} owed (${money(r.owed_cents)})`
      : null,
  ].filter(Boolean);

  const tileHtml = `<table style="width:100%;border-collapse:separate;border-spacing:6px;margin:10px -6px;"><tr>${tiles
    .map(
      ([n, label]) =>
        `<td style="width:25%;padding:14px 10px;background:#faf7f2;border:1px solid #eee5d3;text-align:center;vertical-align:top;"><div style="font-size:22px;font-weight:600;color:#1c1a16;">${escapeHtml(
          n
        )}</div><div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#6b655b;margin-top:4px;">${escapeHtml(
          label
        )}</div></td>`
    )
    .join("")}</tr></table>`;
  const list = (title, items) =>
    items.length
      ? `<p style="margin:18px 0 6px;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8a6d1f;">${title}</p><ul style="margin:0;padding-left:18px;">${items
          .map((i) => `<li style="margin:3px 0;">${escapeHtml(i)}</li>`)
          .join("")}</ul>`
      : "";

  const textList = (title, items) => (items.length ? [title, ...items.map((i) => `- ${i}`), ""] : []);

  // "Wrap up visits" opens without logging in: a 7-day pass for the last
  // 14 days (the same days counted in "visits to wrap up").
  const [y, m, d] = r.week_end.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d - 13)).toISOString().slice(0, 10);
  const wrapLink = `${base}/visits?p=${makeVisitPass(r.stylist_id, from, r.week_end)}`;

  return {
    to,
    subject: `Your week at ${r.business_name}: ${plural(r.visits, "visit", "visits")}, ${money(r.booked_cents)} booked`,
    html: emailLayout("Your week", [
      `<p>${name ? `Good morning, ${escapeHtml(name)}.` : "Good morning."} Here's how last week went at <strong>${escapeHtml(
        r.business_name
      )}</strong> (${escapeHtml(range)}).</p>`,
      tileHtml,
      list("Last week", lastWeek),
      list("This week", thisWeek),
      list("To do", todo),
      `<p style="margin-top:22px;">${emailButton(`${base}/dashboard`, "Open your dashboard")}${
        todo.length ? ` &nbsp; ${emailButton(wrapLink, "Wrap up visits", { outline: true })}` : ""
      }</p>`,
      `<p style="color:#6b655b;font-size:13px;">"Booked" is the listed price of visits that went ahead. No-shows and visits someone else took aren't counted.</p>`,
    ]),
    text: [
      name ? `Good morning, ${name}.` : "Good morning.",
      `Here's how last week went at ${r.business_name} (${range}).`,
      "",
      ...tiles.map(([n, label]) => `${label}: ${n}`),
      "",
      ...textList("Last week", lastWeek),
      ...textList("This week", thisWeek),
      ...textList("To do", todo),
      `Open your dashboard: ${base}/dashboard`,
      todo.length ? `Wrap up visits: ${wrapLink}` : "",
    ]
      .filter((line, i, all) => line !== "" || all[i - 1] !== "")
      .join("\n"),
  };
}

// The every-minute check. Quietly does nothing before the step 19 SQL
// (0024) is run or while email isn't set up. Returns { sent }.
export async function runWeeklySummaries() {
  if (!emailConfigured() || !process.env.SUPABASE_SECRET_KEY) return { sent: 0 };
  const admin = createAdminClient();
  const { data: rows, error } = await admin.rpc("weekly_summary_due");
  if (error) {
    if (!/weekly_summary_due/.test(error.message)) console.error("weekly_summary_due failed", error.message);
    return { sent: 0 };
  }
  if (!rows?.length) return { sent: 0 };

  const today = (r) => {
    // The Monday it was sent: the day after last week's Sunday.
    const [y, m, d] = r.week_end.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  };

  const base = siteBase();
  const emails = await stylistEmails(admin, rows.map((r) => r.stylist_id));
  const due = rows.filter((r) => emails[r.stylist_id] && !summaryIsEmpty(r));
  const results = await sendEmails(due.map((r) => weeklySummaryEmail(r, emails[r.stylist_id], base)));

  let sent = 0;
  for (const [i, r] of due.entries()) {
    if (!results[i]?.ok) {
      console.error("Weekly summary didn't send", r.stylist_id, results[i]?.error);
      continue;
    }
    await admin.rpc("weekly_summary_mark", { p_stylist_id: r.stylist_id, p_date: today(r) });
    sent += 1;
  }
  // Nothing to report, or no email address: skip until next Monday.
  for (const r of rows.filter((r) => !emails[r.stylist_id] || summaryIsEmpty(r))) {
    await admin.rpc("weekly_summary_mark", { p_stylist_id: r.stylist_id, p_date: today(r) });
  }
  return { sent };
}

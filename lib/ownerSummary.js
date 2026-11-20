// A weekly email to the owner (ADMIN_EMAILS): how Clientele did last week.
// Sent once, on Monday from 9 AM Central, by the every-minute check. Uses
// the rate_events table (step 46 SQL) to send it only once a week.
import { createAdminClient } from "@/lib/supabase/admin";
import { adminEmails } from "@/lib/admin";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { publicSiteUrl } from "@/lib/siteUrl";

const count = async (query) => {
  const { count: n, error } = await query;
  return error ? null : n || 0;
};

export async function runOwnerSummary() {
  if (!emailConfigured() || !process.env.SUPABASE_SECRET_KEY || !adminEmails().length) return { sent: 0 };
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short", hour: "numeric", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value])
  );
  if (parts.weekday !== "Mon" || Number(parts.hour) < 9) return { sent: 0 };

  const admin = createAdminClient();
  const week = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago" }).format(new Date());
  // Only the first check each Monday gets through.
  const { data: first, error: rateError } = await admin.rpc("rate_ok", { p_bucket: `owner-weekly:${week}`, p_max: 1, p_window: "7 days" });
  if (rateError || first !== true) return { sent: 0 };

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [pros, newPros, paying, bookings, cancelled, errors, feedback] = await Promise.all([
    count(admin.from("stylists").select("id", { count: "exact", head: true })),
    count(admin.from("stylists").select("id", { count: "exact", head: true }).gte("created_at", since)),
    count(admin.from("stylist_plans").select("stylist_id", { count: "exact", head: true }).in("stripe_status", ["active", "trialing"])),
    count(admin.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", since)),
    count(admin.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", since).eq("status", "cancelled")),
    count(admin.from("error_alerts").select("signature", { count: "exact", head: true }).gte("last_seen", since)),
    count(admin.from("trial_feedback").select("id", { count: "exact", head: true }).gte("created_at", since)),
  ]);
  const show = (n) => (n == null ? "—" : String(n));
  const rows = [
    ["Pros on Clientele", show(pros)],
    ["New pros this week", show(newPros)],
    ["Paying (active plans)", show(paying)],
    ["Bookings made this week", show(bookings)],
    ["  of those, cancelled", show(cancelled)],
    ["Trial feedback received", show(feedback)],
    ["Problems on the site (errors)", show(errors)],
  ];
  const base = publicSiteUrl("https://www.clientelesuite.com");
  const results = await sendEmails(
    adminEmails().map((to) => ({
      to,
      subject: `Clientele this week: ${show(newPros)} new pros, ${show(bookings)} bookings`,
      html: emailLayout("Clientele this week", [
        `<table style="width:100%;border-collapse:collapse;">${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:8px 0;border-bottom:1px solid #eee;">${escapeHtml(k)}</td><td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;"><strong>${escapeHtml(v)}</strong></td></tr>`
          )
          .join("")}</table>`,
        `<p>${emailButton(`${base}/dashboard/admin/errors`, "Errors", { outline: true })}&nbsp; ${emailButton(`${base}/dashboard/admin/feedback`, "Trial feedback", { outline: true })}</p>`,
      ]),
      text: rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
    }))
  );
  return { sent: results.filter((r) => r.ok).length };
}

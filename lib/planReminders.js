// Emails to stylists about their Clientele account. Server code only.
//   - "Welcome to Clientele"             (every-minute check, once confirmed)
//   - "Your free trial ends in 3 days"   (every-minute check)
//   - "Your Clientele plan is paused"    (every-minute check)
//   - "Your payment didn't go through"   (Stripe webhook, see lib/billing.js)
// Sent from EMAIL_FROM (Clientele <hello@clientelesuite.com>).
import { createAdminClient } from "@/lib/supabase/admin";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { stylistEmails } from "@/lib/waitlist";
import { publicSiteUrl } from "@/lib/siteUrl";
import { PLANS } from "@/lib/plans";
import { formatPrice } from "@/lib/money";

function siteBase() {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return publicSiteUrl(production ? `https://${production}` : "");
}

const hello = (firstName) => (String(firstName || "").trim() ? `Hi ${escapeHtml(firstName.trim())},` : "Hi,");
const plainHello = (firstName) => (String(firstName || "").trim() ? `Hi ${firstName.trim()},` : "Hi,");

function daysLeft(iso) {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

const PRICE_LINE = `Clientele is ${formatPrice(PLANS.base.monthlyCents)}/month (or ${formatPrice(
  PLANS.base.yearlyCents
)}/year), and All-in with Regulars First and Waitlist is ${formatPrice(PLANS.bundle.monthlyCents)}/month.`;

function trialEndingEmail(row, to, base) {
  const days = daysLeft(row.trial_ends_at);
  const when = days === 1 ? "tomorrow" : `in ${days} days`;
  const link = `${base}/dashboard/settings#plan`;
  return {
    to,
    subject: `Your Clientele free trial ends ${when}`,
    html: emailLayout(`Your free trial ends ${when}`, [
      `<p>${hello(row.first_name)}</p>`,
      `<p>Your free trial of Clientele for <strong>${escapeHtml(row.business_name)}</strong> ends ${when}. Choose a plan to keep your booking page, Regulars First and your waitlist running without a break.</p>`,
      `<p>${escapeHtml(PRICE_LINE)}</p>`,
      `<p>${emailButton(link, "Choose a plan")}</p>`,
      `<p style="color:#6b655b;font-size:13px;">If you don't choose a plan, your bookings and clients are kept, and you can pick a plan any time.</p>`,
    ]),
    text: `${plainHello(row.first_name)}\n\nYour free trial of Clientele for ${row.business_name} ends ${when}. Choose a plan to keep everything running without a break.\n\n${PRICE_LINE}\n\nChoose a plan: ${link}\n\nIf you don't choose a plan, your bookings and clients are kept, and you can pick a plan any time.`,
  };
}

function welcomeEmail(row, to, base) {
  const bookingLink = `${base}/book/${row.slug}`;
  const dashboard = `${base}/dashboard`;
  const trial = row.trial_ends_at
    ? `Your free trial runs until ${new Date(row.trial_ends_at).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })}, with everything switched on. No card needed.`
    : "";
  const step = (n, title, text) =>
    `<p style="margin:0 0 10px;"><strong>${n}. ${title}</strong><br><span style="color:#6b655b;">${text}</span></p>`;
  return {
    to,
    subject: "Welcome to Clientele",
    html: emailLayout("Welcome to Clientele", [
      `<p>${hello(row.first_name)}</p>`,
      `<p><strong>${escapeHtml(row.business_name)}</strong> is set up. This is your booking link, the one to share with your clients:</p>`,
      `<p style="padding:12px 14px;background:#f6f3ec;border-radius:8px;word-break:break-all;"><a href="${escapeHtml(bookingLink)}" style="color:#1c1a16;">${escapeHtml(bookingLink)}</a></p>`,
      `<p>Three steps before you share it:</p>`,
      step(1, "Add your services", "Settings &rarr; Services &amp; prices: what clients can book, with prices and times."),
      step(2, "Set your hours", "Settings &rarr; Working hours &amp; days off."),
      step(3, "Open some times", "The Openings tab: the times clients can book. Mark some \"Regulars only\" to give your regulars first pick."),
      trial ? `<p>${escapeHtml(trial)}</p>` : "",
      `<p>${emailButton(dashboard, "Open your dashboard")}</p>`,
    ]),
    text: `${plainHello(row.first_name)}\n\n${row.business_name} is set up. Your booking link, to share with your clients:\n${bookingLink}\n\nThree steps before you share it:\n1. Add your services (Settings -> Services & prices)\n2. Set your hours (Settings -> Working hours & days off)\n3. Open some times (the Openings tab). Mark some "Regulars only" to give your regulars first pick.\n\n${trial}\n\nOpen your dashboard: ${dashboard}`,
  };
}

function pausedEmail(row, to, base) {
  const link = `${base}/dashboard/settings#plan`;
  return {
    to,
    subject: "Your Clientele plan is paused",
    html: emailLayout("Your Clientele plan is paused", [
      `<p>${hello(row.first_name)}</p>`,
      `<p>Your Clientele plan for <strong>${escapeHtml(row.business_name)}</strong> isn't active right now, so Regulars-only mode and your waitlist have been switched off.</p>`,
      `<p>Nothing is deleted: your bookings, clients and openings are all still there. Choose a plan and everything is ready to switch back on.</p>`,
      `<p>${emailButton(link, "Choose a plan")}</p>`,
    ]),
    text: `${plainHello(row.first_name)}\n\nYour Clientele plan for ${row.business_name} isn't active right now, so Regulars-only mode and your waitlist have been switched off.\n\nNothing is deleted: your bookings, clients and openings are all still there. Choose a plan and everything is ready to switch back on.\n\nChoose a plan: ${link}`,
  };
}

export function paymentFailedEmail({ to, businessName, firstName }) {
  const link = `${siteBase()}/dashboard/billing/portal`;
  return {
    to,
    subject: "Your Clientele payment didn't go through",
    html: emailLayout("Your payment didn't go through", [
      `<p>${hello(firstName)}</p>`,
      `<p>We couldn't take the payment for your Clientele plan for <strong>${escapeHtml(businessName)}</strong>. Stripe will try again over the next few days, and everything stays on in the meantime.</p>`,
      `<p>To avoid any interruption, please check your card.</p>`,
      `<p>${emailButton(link, "Update card")}</p>`,
    ]),
    text: `${plainHello(firstName)}\n\nWe couldn't take the payment for your Clientele plan for ${businessName}. Stripe will try again over the next few days, and everything stays on in the meantime.\n\nTo avoid any interruption, please check your card: ${link}`,
  };
}

// The every-minute check: sends any trial-ending and paused reminders due.
// Returns how many were sent. Quietly does nothing before the SQL (0019) is
// run or while email isn't set up.
export async function runPlanReminders() {
  if (!emailConfigured() || !process.env.SUPABASE_SECRET_KEY) return { sent: 0 };
  const admin = createAdminClient();
  const { data: rows, error } = await admin.rpc("plan_due_reminders");
  if (error) {
    if (!/plan_due_reminders/.test(error.message)) console.error("plan_due_reminders failed", error.message);
    return { sent: 0 };
  }
  if (!rows?.length) return { sent: 0 };

  const base = siteBase();
  const emails = await stylistEmails(admin, [...new Set(rows.map((r) => r.stylist_id))]);
  const due = rows.filter((r) => emails[r.stylist_id]);
  const results = await sendEmails(
    due.map((r) =>
      r.kind === "welcome"
        ? welcomeEmail(r, emails[r.stylist_id], base)
        : r.kind === "trial_ending"
          ? trialEndingEmail(r, emails[r.stylist_id], base)
          : pausedEmail(r, emails[r.stylist_id], base)
    )
  );

  let sent = 0;
  for (const [i, r] of due.entries()) {
    if (!results[i]?.ok) {
      console.error("Plan reminder didn't send", r.kind, r.stylist_id, results[i]?.error);
      continue;
    }
    await admin.rpc("plan_mark_reminder", { p_stylist_id: r.stylist_id, p_kind: r.kind });
    sent += 1;
  }
  return { sent };
}

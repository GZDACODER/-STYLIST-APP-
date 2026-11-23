// Emails to clients from the every-minute check (step 46 SQL). Server only.
//   - After a visit (2 hours after it ends): the service's aftercare tips, if
//     the pro wrote any, and "How was it?" with one-tap stars.
//   - On their birthday (from 9 AM, pro's time zone): the pro's birthday perk.
// Quietly does nothing before the SQL is run or while email isn't set up.
import { createAdminClient } from "@/lib/supabase/admin";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { clientReplyEmails } from "@/lib/waitlist";
import { publicSiteUrl } from "@/lib/siteUrl";
import { reportError } from "@/lib/errorAlerts";
import { templateFor } from "@/lib/templates";

const site = () => publicSiteUrl("https://www.clientelesuite.com");
const firstName = (name) => String(name || "").trim().split(/\s+/)[0];
const hello = (name) => (firstName(name) ? `Hi ${escapeHtml(firstName(name))},` : "Hi,");

function stars(token) {
  const base = site();
  return [1, 2, 3, 4, 5]
    .map(
      (n) =>
        `<a href="${escapeHtml(`${base}/client/rate?t=${token}&r=${n}`)}" style="display:inline-block;margin:0 4px;font-size:28px;line-height:1;color:#c8a96a;text-decoration:none;" aria-label="${n} star${n === 1 ? "" : "s"}">★</a>`
    )
    .join("");
}

function afterVisitEmail(r, replyTo, tpl = templateFor("")) {
  const base = site();
  // Aftercare tips only if the pro has them on (off for tutors by default).
  const tips = tpl.modules.aftercare ? String(r.aftercare || "").trim() : "";
  const W = tpl.words;
  return {
    to: r.client_email,
    replyTo,
    subject: tips ? `Aftercare for your ${r.service_name}` : `How was your ${r.service_name}?`,
    html: emailLayout(tips ? "Your aftercare" : `How was your ${W.visit}?`, [
      `<p>${hello(r.client_name)}</p>`,
      tpl.key === "tutor"
        ? `<p>Thanks for your ${W.visit} with ${escapeHtml(r.business_name)}.</p>`
        : `<p>Thanks for coming in to ${escapeHtml(r.business_name)}.</p>`,
      tips
        ? `<p style="margin:18px 0;padding:14px 16px;background:#f3eee5;border-left:3px solid #a8874d;white-space:pre-line;">${escapeHtml(tips)}</p>`
        : "",
      `<p><strong>How was it?</strong> Tap a star (only ${escapeHtml(r.business_name)} sees it):</p>`,
      `<p>${stars(r.cancel_token)}</p>`,
      tpl.rebookWeeks
        ? `<p>Most clients rebook every ${tpl.rebookWeeks} weeks to keep it sharp.</p>`
        : "",
      r.pro_code
        ? `<p>${emailButton(`${base}/client?code=${r.pro_code}`, `Book your next ${W.visit}`, { outline: true })}</p>`
        : "",
    ]),
    text: `${firstName(r.client_name) ? `Hi ${firstName(r.client_name)},` : "Hi,"}\n\nThanks for coming in to ${r.business_name}.\n\n${tips ? `${tips}\n\n` : ""}How was it? ${base}/client/rate?t=${r.cancel_token}&r=5`,
  };
}

function birthdayEmail(r, replyTo) {
  const base = site();
  return {
    to: r.client_email,
    replyTo,
    subject: `Happy birthday from ${r.business_name}`,
    html: emailLayout("Happy birthday!", [
      `<p>${hello(r.client_name)}</p>`,
      `<p>Happy birthday from everyone at ${escapeHtml(r.business_name)}.</p>`,
      `<p style="margin:18px 0;padding:14px 16px;background:#f3eee5;border-left:3px solid #a8874d;"><strong>Your birthday treat:</strong> ${escapeHtml(r.birthday_perk)}</p>`,
      `<p>${emailButton(r.pro_code ? `${base}/client?code=${r.pro_code}` : `${base}/book/${r.slug}`, "Book a visit")}</p>`,
    ]),
    text: `Happy birthday from ${r.business_name}! Your birthday treat: ${r.birthday_perk}\n\nBook: ${base}/book/${r.slug}`,
  };
}

async function run(admin, dueFn, markFn, build, markArgs) {
  const { data: rows, error } = await admin.rpc(dueFn);
  if (error) {
    if (!new RegExp(dueFn).test(error.message)) await reportError("Client emails", new Error(`${dueFn}: ${error.message}`));
    return 0;
  }
  if (!rows?.length) return 0;
  const replyTo = await clientReplyEmails(admin, rows.map((r) => r.stylist_id));
  // Each pro's template (lib/templates): their words, and extras like a
  // barber's "rebook in 2 weeks".
  const ids = [...new Set(rows.map((r) => r.stylist_id))];
  const { data: types } = await admin.from("stylists").select("id, business_type, modules").in("id", ids);
  const tplOf = Object.fromEntries((types || []).map((t) => [t.id, templateFor(t.business_type, t.modules)]));
  const results = await sendEmails(rows.map((r) => build(r, replyTo[r.stylist_id], tplOf[r.stylist_id] || templateFor(""))));
  let sent = 0;
  for (const [i, r] of rows.entries()) {
    if (!results[i]?.ok) continue;
    await admin.rpc(markFn, markArgs(r));
    sent += 1;
  }
  return sent;
}

export async function runClientEmails() {
  if (!emailConfigured() || !process.env.SUPABASE_SECRET_KEY) return { afterVisit: 0, birthdays: 0 };
  const admin = createAdminClient();
  const afterVisit = await run(admin, "after_visit_due", "after_visit_mark", afterVisitEmail, (r) => ({ p_booking_id: r.booking_id }));
  const birthdays = await run(admin, "birthday_perks_due", "birthday_mark", birthdayEmail, (r) => ({ p_client_id: r.client_id, p_year: r.year }));
  return { afterVisit, birthdays };
}

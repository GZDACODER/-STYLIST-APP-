// Getting-started emails for new pros during the free trial (after the
// welcome email in lib/planReminders.js). Each one is sent only if it still
// applies, never more than one a day (see 0047_onboarding_emails.sql).
// Server code only.
import { createAdminClient } from "@/lib/supabase/admin";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { stylistEmails } from "@/lib/waitlist";
import { publicSiteUrl } from "@/lib/siteUrl";
import { reportError } from "@/lib/errorAlerts";

function siteBase() {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return publicSiteUrl(production ? `https://${production}` : "");
}

const name = (r) => String(r.first_name || "").trim();
const hello = (r) => (name(r) ? `Hi ${escapeHtml(name(r))},` : "Hi,");
const plainHello = (r) => (name(r) ? `Hi ${name(r)},` : "Hi,");
const FOOT = `<p style="color:#6b655b;font-size:13px;">A few short tips like this during your free trial, only when they still apply. Just reply if you have a question.</p>`;
const PLAIN_FOOT = "A few short tips like this during your free trial, only when they still apply. Just reply if you have a question.";

// Each email: subject, heading, html parts, plain text and a button.
function build(r, base) {
  const link = `${base}/book/${r.slug}`;
  const item = (title, text) => `<p style="margin:0 0 10px;"><strong>${title}</strong><br><span style="color:#6b655b;">${text}</span></p>`;

  if (r.kind === "finish_setup") {
    const left = [
      !r.has_services && ["Add your services", "Settings → Services & prices: what clients can book, with prices and times.", "/dashboard/services"],
      !r.has_hours && ["Set your working hours", "Settings → Working hours & days off, so only real times show.", "/dashboard/availability"],
      !r.has_openings && ["Open some times", "The Openings tab: the times clients can book.", "/dashboard/openings"],
    ].filter(Boolean);
    return {
      subject: "Your booking page is almost ready",
      heading: "Almost ready to take bookings",
      html: [
        `<p>${hello(r)}</p>`,
        `<p>A couple of steps and clients can book <strong>${escapeHtml(r.business_name)}</strong>. Each takes a few minutes:</p>`,
        ...left.map(([t, x]) => item(escapeHtml(t), escapeHtml(x))),
      ],
      text: `${plainHello(r)}\n\nA couple of steps and clients can book ${r.business_name}:\n${left.map(([t, x]) => `- ${t}: ${x}`).join("\n")}`,
      button: [`${base}${left[0]?.[2] || "/dashboard"}`, left[0] ? left[0][0] : "Open your dashboard"],
    };
  }

  if (r.kind === "first_booking") {
    return {
      subject: "Get your first booking on Clientele",
      heading: "Time to share your link",
      html: [
        `<p>${hello(r)}</p>`,
        `<p>You're set up. Clients book you here:</p>`,
        `<p style="padding:12px 14px;background:#f6f3ec;border-radius:8px;word-break:break-all;"><a href="${escapeHtml(link)}" style="color:#1c1a16;">${escapeHtml(link)}</a></p>`,
        item("Put it in your Instagram bio", "Most new clients find you there. Add it to your TikTok and Google profile too."),
        item("Text it to your regulars", "“I've moved my booking online, book your next one here.” Mark them as Regulars in Clients so they get first pick."),
        item("Send it when someone DMs", "Instead of going back and forth on times, reply with the link."),
        item("Closed on holidays?", "Thanksgiving, Christmas and the other federal holidays stay open until you close them: Settings → Holidays."),
      ],
      text: `${plainHello(r)}\n\nYou're set up. Clients book you here:\n${link}\n\n- Put it in your Instagram bio (and TikTok, Google).\n- Text it to your regulars, and mark them as Regulars in Clients so they get first pick.\n- Send it when someone DMs about times.\n- Closed on holidays? They stay open until you close them: Settings -> Holidays.`,
      button: [`${base}/dashboard/openings`, "Copy your link"],
    };
  }

  if (r.kind === "deposits") {
    return {
      subject: "Stop no-shows with deposits",
      heading: "Take a deposit when they book",
      html: [
        `<p>${hello(r)}</p>`,
        `<p>A deposit makes a no-show cost the client, not you. Connect Stripe once and clients pay when they book, straight into your account.</p>`,
        item("Your amount, per service", "A dollar amount or a percent. Leave quick services free."),
        item("Your cancellation policy", "Clients agree to it before paying. Late cancel? Keep the deposit or refund it in one tap."),
        item("Apple Pay and Google Pay", "On phones that have them, so paying takes seconds."),
      ],
      text: `${plainHello(r)}\n\nA deposit makes a no-show cost the client, not you. Connect Stripe once and clients pay when they book, straight into your account.\n\n- Your amount, per service (dollars or percent).\n- Your cancellation policy, agreed before paying.\n- Apple Pay and Google Pay.`,
      button: [`${base}/dashboard/settings/deposits`, "Connect Stripe"],
    };
  }

  // features
  return {
    subject: "4 things in Clientele you might not have tried",
    heading: "A few things worth trying",
    html: [
      `<p>${hello(r)}</p>`,
      `<p>Your trial includes everything, so it's a good week to try these:</p>`,
      item("Regulars First", "Mark an opening “Regulars only” and nobody else sees it. Book full? Switch the whole page to regulars-only."),
      item("Smart waitlist", "When someone cancels, the waitlist is emailed straight away, regulars first. First to claim it gets it."),
      item("Standing appointments", "Set a regular's every-4-weeks Tuesday once. Their visits are held three months ahead."),
      item("The Assistant", "Tap Assistant and ask “Who's booked tomorrow?” or say “Block off Friday afternoon”. Nothing changes until you confirm."),
    ],
    text: `${plainHello(r)}\n\nYour trial includes everything, so it's a good week to try these:\n- Regulars First: "Regulars only" openings nobody else sees.\n- Smart waitlist: cancellations are offered to the waitlist straight away, regulars first.\n- Standing appointments: a regular's usual time, held three months ahead.\n- The Assistant: ask about your schedule or make changes in plain words.`,
    button: [`${base}/dashboard`, "Open your dashboard"],
  };
}

function email(r, to, base) {
  const e = build(r, base);
  const [href, label] = e.button;
  return {
    to,
    subject: e.subject,
    html: emailLayout(e.heading, [...e.html, `<p>${emailButton(href, label)}</p>`, FOOT]),
    text: `${e.text}\n\n${label}: ${href}\n\n${PLAIN_FOOT}`,
  };
}

// The every-minute check. Quietly does nothing before the SQL (0047) is run
// or while email isn't set up.
export async function runOnboardingEmails() {
  if (!emailConfigured() || !process.env.SUPABASE_SECRET_KEY) return { sent: 0 };
  const admin = createAdminClient();
  const { data: rows, error } = await admin.rpc("onboarding_due_emails");
  if (error) {
    if (!/onboarding_due_emails/.test(error.message)) await reportError("Getting-started emails", new Error(error.message));
    return { sent: 0 };
  }
  if (!rows?.length) return { sent: 0 };

  const base = siteBase();
  const emails = await stylistEmails(admin, [...new Set(rows.map((r) => r.stylist_id))]);
  const replyTo = (process.env.ADMIN_EMAILS || "").split(",")[0]?.trim() || undefined;
  const due = rows.filter((r) => emails[r.stylist_id]);
  const results = await sendEmails(due.map((r) => ({ ...email(r, emails[r.stylist_id], base), replyTo })));

  let sent = 0;
  for (const [i, r] of due.entries()) {
    if (!results[i]?.ok) {
      console.error("Getting-started email didn't send", r.kind, r.stylist_id, results[i]?.error);
      continue;
    }
    await admin.rpc("onboarding_mark_sent", { p_stylist_id: r.stylist_id, p_kind: r.kind });
    sent += 1;
  }
  return { sent };
}

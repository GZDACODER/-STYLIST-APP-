// Emails to clients about their bookings. Server code only.
//   - "You're booked"  (soon after booking; standing visits a week ahead)
//   - "See you tomorrow" reminder (24 hours before)
// Both have a "Cancel this visit" link, and standing visits with a deposit
// due have a "Pay your deposit" link. Sent by the every-minute check from
// EMAIL_FROM, with replies going to the stylist.
import { createAdminClient } from "@/lib/supabase/admin";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { stylistEmails } from "@/lib/waitlist";
import { publicSiteUrl } from "@/lib/siteUrl";
import { WEEKDAYS, clockTime, formatDate, timeZoneLabel, todayInTimeZone } from "@/lib/availability";
import { formatPrice } from "@/lib/money";

function siteBase() {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return publicSiteUrl(production ? `https://${production}` : "");
}

const firstWord = (name) => String(name || "").trim().split(/\s+/)[0] || "";

// "today", "tomorrow" or "on Tue, Nov 10, 2026", in the stylist's time zone.
function dayWords(row) {
  const today = todayInTimeZone(row.timezone);
  const [y, m, d] = today.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  if (row.booking_date === today) return "today";
  if (row.booking_date === tomorrow) return "tomorrow";
  return `on ${formatDate(row.booking_date)}`;
}

export function bookingEmail(row, base, replyTo) {
  const reminder = row.kind === "reminder";
  const book = `${base}/book/${row.slug}`;
  const cancelLink = `${book}/cancel?t=${row.cancel_token}`;
  const payLink = `${book}/pay?t=${row.cancel_token}`;
  const time = `${clockTime(row.start_time)} – ${clockTime(row.end_time)}`;
  const date = formatDate(row.booking_date);
  const zone = `${timeZoneLabel(row.timezone)} time`;
  const name = firstWord(row.client_name);
  const depositDue = row.deposit_status === "unpaid" && row.deposit_cents > 0;

  const subject = reminder
    ? `Reminder: ${row.service_name} ${dayWords(row)} at ${clockTime(row.start_time)}`
    : row.standing
      ? `Your standing appointment with ${row.business_name}: ${date} at ${clockTime(row.start_time)}`
      : `You're booked with ${row.business_name}: ${date} at ${clockTime(row.start_time)}`;
  const heading = reminder
    ? `See you ${dayWords(row)}`
    : row.standing
      ? "Your next standing appointment"
      : "You're booked!";

  const intro = reminder
    ? `A reminder of your appointment with ${row.business_name}.`
    : row.standing
      ? `Your standing appointment with ${row.business_name}${
          row.interval_weeks ? ` (every ${row.interval_weeks} weeks)` : ""
        } is coming up.`
      : `Your appointment with ${row.business_name} is confirmed.`;

  let depositLine = "";
  if (row.deposit_status === "paid" && row.deposit_cents > 0) {
    const balance = row.price_cents - row.deposit_cents;
    depositLine = `Deposit paid: ${formatPrice(row.deposit_cents)}${
      balance > 0 ? ` · ${formatPrice(balance)} left to pay at your appointment` : ""
    }`;
  } else if (depositDue) {
    depositLine = `A ${formatPrice(row.deposit_cents)} deposit is due for this visit.`;
  }

  const policy = String(row.cancellation_policy || "").trim();
  const muted = (text) => `<p style="color:#6b655b;font-size:13px;">${text}</p>`;

  const html = emailLayout(escapeHtml(heading), [
    `<p>${name ? `Hi ${escapeHtml(name)},` : "Hi,"}</p>`,
    `<p>${escapeHtml(intro)}</p>`,
    `<p style="margin:18px 0;padding:14px 16px;background:#faf7f2;border-left:3px solid #c9a646;"><strong>${escapeHtml(
      row.service_name
    )}</strong><br>${escapeHtml(date)}<br>${escapeHtml(time)} <span style="color:#6b655b;">(${escapeHtml(
      zone
    )})</span>${row.price_cents ? `<br>${escapeHtml(formatPrice(row.price_cents))}` : ""}</p>`,
    depositLine ? `<p>${escapeHtml(depositLine)}</p>` : "",
    depositDue ? `<p>${emailButton(payLink, `Pay your ${formatPrice(row.deposit_cents)} deposit`)}</p>` : "",
    policy ? muted(`<strong>Cancellation policy:</strong> ${escapeHtml(policy)}`) : "",
    `<p>${emailButton(cancelLink, "Cancel this visit", { outline: true })}</p>`,
    muted(
      `Need to change something? Reply to this email to reach ${escapeHtml(row.business_name)}.`
    ),
  ]);

  const text = [
    name ? `Hi ${name},` : "Hi,",
    "",
    intro,
    "",
    row.service_name,
    date,
    `${time} (${zone})`,
    row.price_cents ? formatPrice(row.price_cents) : "",
    "",
    depositLine,
    depositDue ? `Pay your deposit: ${payLink}` : "",
    policy ? `Cancellation policy: ${policy}` : "",
    "",
    `Cancel this visit: ${cancelLink}`,
    "",
    `Need to change something? Reply to this email to reach ${row.business_name}.`,
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");

  return { to: row.client_email, subject, html, text, replyTo };
}

// "Your standing appointment": sent once, straight after a standing
// appointment is set up. Lists the schedule and the next dates, with a cancel
// link for the first one. (It stands in for the first week's confirmation.)
export function standingSetupEmail(row, base, replyTo) {
  const book = `${base}/book/${row.slug}`;
  const dayName = WEEKDAYS.find((d) => d.dow === Number(row.weekday))?.name || "";
  const plural = `${dayName}s`;
  const schedule = `Every ${row.interval_weeks} weeks · ${plural} at ${clockTime(row.start_time)}`;
  const zone = `${timeZoneLabel(row.timezone)} time`;
  const dates = (row.next_dates || []).map((d) => ({
    text: `${formatDate(d.date)} at ${clockTime(d.time)}`,
    cancel: `${book}/cancel?t=${d.cancel_token}`,
  }));
  const first = dates[0];
  const name = firstWord(row.client_name);
  const depositLine =
    row.deposit_mode === "each"
      ? "A deposit is due before each visit. We'll email you a link to pay it."
      : "";
  const muted = (text) => `<p style="color:#6b655b;font-size:13px;">${text}</p>`;

  return {
    to: row.client_email,
    subject: `Your standing appointment with ${row.business_name}: ${schedule.replace(" · ", ", ")}`,
    html: emailLayout("Your standing appointment", [
      `<p>${name ? `Hi ${escapeHtml(name)},` : "Hi,"}</p>`,
      `<p>${escapeHtml(row.business_name)} has set up a standing appointment for you, so your usual time is held.</p>`,
      `<p style="margin:18px 0;padding:14px 16px;background:#faf7f2;border-left:3px solid #c9a646;"><strong>${escapeHtml(
        row.service_name
      )}</strong><br>${escapeHtml(schedule)}<br><span style="color:#6b655b;">(${escapeHtml(zone)})</span></p>`,
      dates.length
        ? `<p style="margin:0 0 6px;"><strong>Your next visits</strong></p><ul style="margin:0 0 14px;padding-left:18px;">${dates
            .map((d) => `<li style="margin:3px 0;">${escapeHtml(d.text)}</li>`)
            .join("")}</ul>`
        : "",
      depositLine ? `<p>${escapeHtml(depositLine)}</p>` : "",
      muted("You'll get a reminder 24 hours before each visit."),
      first ? `<p>${emailButton(first.cancel, `Can't make ${formatDate(row.next_dates[0].date)}? Cancel that visit`, { outline: true })}</p>` : "",
      muted(`To change the schedule, reply to this email to reach ${escapeHtml(row.business_name)}.`),
    ]),
    text: [
      name ? `Hi ${name},` : "Hi,",
      "",
      `${row.business_name} has set up a standing appointment for you, so your usual time is held.`,
      "",
      row.service_name,
      schedule,
      `(${zone})`,
      "",
      dates.length ? "Your next visits:" : "",
      ...dates.map((d) => `- ${d.text}`),
      "",
      depositLine,
      "You'll get a reminder 24 hours before each visit.",
      first ? `Can't make the first one? Cancel that visit: ${first.cancel}` : "",
      "",
      `To change the schedule, reply to this email to reach ${row.business_name}.`,
    ]
      .filter((line, i, all) => line !== "" || all[i - 1] !== "")
      .join("\n"),
    replyTo,
  };
}

// The every-minute check: books standing visits for the next 3 months, then
// sends any booking emails due. Quietly does nothing before the step 16 SQL
// (0021) is run. Returns { held, sent }.
export async function runBookingEmails() {
  if (!process.env.SUPABASE_SECRET_KEY) return { held: 0, sent: 0 };
  const admin = createAdminClient();

  let held = 0;
  const fill = await admin.rpc("standing_fill", {});
  if (fill.error) {
    if (!/standing_fill/.test(fill.error.message)) console.error("standing_fill failed", fill.error.message);
  } else {
    held = fill.data || 0;
  }

  if (!emailConfigured()) return { held, sent: 0 };

  // New standing appointments: one "set up" email each (step 20 SQL).
  let setupSent = 0;
  const setup = await admin.rpc("standing_setup_due");
  if (setup.error) {
    if (!/standing_setup_due/.test(setup.error.message)) {
      console.error("standing_setup_due failed", setup.error.message);
    }
  } else if (setup.data?.length) {
    const base = siteBase();
    const replyTo = await stylistEmails(admin, [...new Set(setup.data.map((r) => r.stylist_id))]);
    const results = await sendEmails(setup.data.map((r) => standingSetupEmail(r, base, replyTo[r.stylist_id])));
    for (const [i, r] of setup.data.entries()) {
      if (!results[i]?.ok) {
        console.error("Standing set-up email didn't send", r.series_id, results[i]?.error);
        continue;
      }
      await admin.rpc("standing_setup_mark", { p_series_id: r.series_id });
      setupSent += 1;
    }
  }

  const { data: rows, error } = await admin.rpc("booking_due_emails");
  if (error) {
    if (!/booking_due_emails/.test(error.message)) console.error("booking_due_emails failed", error.message);
    return { held, sent: setupSent };
  }
  if (!rows?.length) return { held, sent: setupSent };

  const base = siteBase();
  const replyTo = await stylistEmails(admin, [...new Set(rows.map((r) => r.stylist_id))]);
  const results = await sendEmails(rows.map((r) => bookingEmail(r, base, replyTo[r.stylist_id])));

  let sent = setupSent;
  for (const [i, r] of rows.entries()) {
    const ok = Boolean(results[i]?.ok);
    if (!ok) console.error("Booking email didn't send", r.kind, r.booking_id, results[i]?.error);
    await admin.rpc("booking_mark_email", { p_booking_id: r.booking_id, p_kind: r.kind, p_ok: ok });
    if (ok) sent += 1;
  }
  return { held, sent };
}

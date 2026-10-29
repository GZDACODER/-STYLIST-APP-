// The waitlist's messages: "A time opened up, claim it". Server code only.
//
// runWaitlist() asks the database what's newly open and who to tell, then
// sends the emails (and texts, once they're switched on).
import { createAdminClient } from "@/lib/supabase/admin";
import { clockTime, formatDate } from "@/lib/availability";
import { formatPrice } from "@/lib/money";
import {
  emailButton,
  emailConfigured,
  emailLayout,
  escapeHtml,
  sendEmails,
  sendText,
  textsEnabled,
} from "@/lib/notify";

// Most times listed in one email, and per day.
const MAX_TIMES = 6;
const MAX_PER_DAY = 3;

// True when the keys the waitlist needs are in Vercel.
export function waitlistConfigured() {
  return emailConfigured() && Boolean(process.env.SUPABASE_SECRET_KEY);
}

// The address links in messages point to. Vercel sets
// VERCEL_PROJECT_PRODUCTION_URL to the site's main address (like
// "your-app.vercel.app"); otherwise use the address the request came in on.
function linkBase(origin) {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (production ? `https://${production}` : origin || "").replace(/\/$/, "");
}

// A few of the times, earliest first: no more than 3 a day, and spaced out
// (9:00, 10:00, 11:00 for an hour-long service, not 9:00, 9:15, 9:30).
function pickTimes(offers) {
  const picked = [];
  for (const offer of offers) {
    const sameDay = picked.filter((p) => p.slot_date === offer.slot_date);
    const last = sameDay[sameDay.length - 1];
    if (sameDay.length >= MAX_PER_DAY || (last && offer.slot_time < last.end_time)) continue;
    picked.push(offer);
    if (picked.length === MAX_TIMES) break;
  }
  return picked;
}

function offerEmail(entry, base, replyTo) {
  const book = `${base}/book/${entry.slug}`;
  const manageUrl = `${book}/waitlist?t=${entry.manage_token}`;
  const times = pickTimes(entry.offers);
  const more = entry.offers.length - times.length;
  const business = escapeHtml(entry.business_name);
  const service = escapeHtml(entry.service_name);
  const firstName = escapeHtml(entry.name.split(" ")[0]);
  const first = entry.offers[0];

  const subject =
    entry.offers.length === 1
      ? `A time opened up with ${entry.business_name}: ${formatDate(first.slot_date)} at ${clockTime(first.slot_time)}`
      : `New times opened up with ${entry.business_name}`;

  const intro = entry.regular
    ? `You're one of ${business}'s regulars, so you're hearing about this first.`
    : `You asked to hear when a time opens up.`;
  const deposit =
    entry.deposit_cents > 0
      ? ` A ${formatPrice(entry.deposit_cents)} deposit is paid when you claim it.`
      : "";

  const html = emailLayout(entry.offers.length === 1 ? "A time opened up" : "New times opened up", [
    `<p>Hi ${firstName},</p>`,
    `<p>${intro} ${entry.offers.length === 1 ? "This time" : "These times"} for <strong>${service}</strong> with ${business} just opened up:</p>`,
    ...times.map(
      (o) =>
        `<p style="margin:18px 0;"><strong>${formatDate(o.slot_date)} at ${clockTime(o.slot_time)}</strong><br>${emailButton(
          `${book}/claim?t=${o.claim_token}`,
          "Claim this time"
        )}</p>`
    ),
    more > 0
      ? `<p><a href="${escapeHtml(manageUrl)}">See ${more} more ${more === 1 ? "time" : "times"}</a></p>`
      : "",
    `<p>The first person to claim a time gets it.${deposit}</p>`,
    `<p style="color:#6b665c;font-size:14px;margin-top:28px;">Found a time, or don't need one any more? <a href="${escapeHtml(
      manageUrl
    )}">Leave the waitlist</a>. Questions? Just reply to this email.</p>`,
  ]);

  const text = [
    `Hi ${entry.name.split(" ")[0]},`,
    "",
    `${entry.regular ? `You're one of ${entry.business_name}'s regulars, so you're hearing about this first. ` : ""}${entry.offers.length === 1 ? "This time" : "These times"} for ${entry.service_name} with ${entry.business_name} just opened up:`,
    "",
    ...times.map(
      (o) =>
        `${formatDate(o.slot_date)} at ${clockTime(o.slot_time)}\nClaim this time: ${book}/claim?t=${o.claim_token}\n`
    ),
    more > 0 ? `${more} more: ${manageUrl}\n` : "",
    `The first person to claim a time gets it.${deposit}`,
    "",
    `Leave the waitlist: ${manageUrl}`,
  ].join("\n");

  return { to: entry.email, subject, html, text, replyTo };
}

function offerText(entry, base) {
  const book = `${base}/book/${entry.slug}`;
  const first = entry.offers[0];
  if (entry.offers.length === 1) {
    return `${entry.business_name}: ${formatDate(first.slot_date)} at ${clockTime(first.slot_time)} just opened up for ${entry.service_name}. First to claim it gets it: ${book}/claim?t=${first.claim_token} Reply STOP to stop texts.`;
  }
  return `${entry.business_name}: ${entry.offers.length} times just opened up for ${entry.service_name}. First to claim one gets it: ${book}/waitlist?t=${entry.manage_token} Reply STOP to stop texts.`;
}

// Each stylist's login email, so clients can reply to the stylist.
async function stylistEmails(admin, ids) {
  const emails = {};
  await Promise.all(
    ids.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      if (data?.user?.email) emails[id] = data.user.email;
    })
  );
  return emails;
}

// Looks for newly opened times and tells waitlisted clients.
// stylistId: one stylist, or null for every stylist (the every-minute check).
// origin: the site's address, for the links.
export async function runWaitlist(stylistId, origin) {
  if (!waitlistConfigured()) return { told: 0 };

  const admin = createAdminClient();
  const { data: entries, error } = await admin.rpc("waitlist_process", {
    p_stylist_id: stylistId || null,
  });
  if (error) throw new Error(`waitlist_process failed: ${error.message}`);
  if (!entries?.length) return { told: 0 };

  const base = linkBase(origin);
  const replyTo = await stylistEmails(admin, [...new Set(entries.map((e) => e.stylist_id))]);
  const texting = textsEnabled();

  const withEmail = entries.filter((e) => e.email);
  const emailResults = await sendEmails(
    withEmail.map((e) => offerEmail(e, base, replyTo[e.stylist_id]))
  );
  const reached = new Set(withEmail.filter((_, i) => emailResults[i]).map((e) => e.entry_id));

  if (texting) {
    for (const entry of entries.filter((e) => e.text_ok && e.phone)) {
      try {
        await sendText(entry.phone, offerText(entry, base));
        reached.add(entry.entry_id);
      } catch (e) {
        console.error("Couldn't send waitlist text", e.message);
      }
    }
  }

  // Nothing got through to these clients: try again next time.
  const failed = entries
    .filter((e) => !reached.has(e.entry_id))
    .flatMap((e) => e.offers.map((o) => o.id));
  if (failed.length) {
    await admin.rpc("waitlist_unmark", { p_offer_ids: failed });
  }

  return { told: reached.size, failed: entries.length - reached.size };
}

// The same, for use right after something changes (a cancellation, new
// openings). A problem here never stops the change itself; the
// every-minute check tries again.
export async function runWaitlistSafely(stylistId, origin) {
  try {
    return await runWaitlist(stylistId, origin);
  } catch (error) {
    console.error("Waitlist check failed", error);
    return { told: 0 };
  }
}

// Tells the stylist a client cancelled from the booking page.
export async function emailStylistCancellation(booking) {
  if (!waitlistConfigured()) return;
  try {
    const admin = createAdminClient();
    const emails = await stylistEmails(admin, [booking.stylist_id]);
    const to = emails[booking.stylist_id];
    if (!to) return;

    const when = `${formatDate(booking.booking_date)} at ${clockTime(booking.start_time)}`;
    const depositNote =
      booking.deposit_status === "paid"
        ? `Their ${formatPrice(booking.deposit_cents)} deposit wasn't refunded. If your policy says to refund it, do that in Stripe (Settings → Open Stripe).`
        : "";
    const name = escapeHtml(booking.client_name);

    await sendEmails([
      {
        to,
        subject: `${booking.client_name} cancelled ${when}`,
        html: emailLayout("A client cancelled", [
          `<p><strong>${name}</strong> cancelled their <strong>${escapeHtml(booking.service_name)}</strong> on ${when}.</p>`,
          `<p>Phone: ${escapeHtml(booking.client_phone)}</p>`,
          `<p>The time is open for booking again, and anyone on your waitlist who wants it has been told.</p>`,
          depositNote ? `<p>${escapeHtml(depositNote)}</p>` : "",
        ]),
        text: `${booking.client_name} cancelled their ${booking.service_name} on ${when}.\nPhone: ${booking.client_phone}\n\nThe time is open for booking again, and anyone on your waitlist who wants it has been told.\n${depositNote}`,
      },
    ]);
  } catch (error) {
    console.error("Couldn't email the stylist about a cancellation", error);
  }
}

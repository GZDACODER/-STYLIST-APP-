// Deposit disputes (chargebacks). Stripe's webhook sends charge.dispute.*
// events; deposits are charged on Clientele's account and passed on to the
// pro (destination charges), so a dispute comes out of Clientele's balance
// first. This saves each dispute with its booking (step 39 SQL) and emails
// the owner (ADMIN_EMAILS) and the pro the evidence Clientele already has.
// Server code only.
import { createAdminClient } from "@/lib/supabase/admin";
import { adminEmails } from "@/lib/admin";
import { emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { stylistEmails } from "@/lib/waitlist";
import { clockTime, formatDate } from "@/lib/availability";
import { formatPrice } from "@/lib/money";
import { outcomeLabel } from "@/lib/outcomes";

// Stripe's dispute reasons, in plain words.
export const DISPUTE_REASONS = {
  fraudulent: "Says they didn't make this payment (fraud)",
  unrecognized: "Doesn't recognize the charge",
  product_not_received: "Says they didn't get the service",
  product_unacceptable: "Says the service wasn't as described",
  credit_not_processed: "Says they were promised a refund",
  duplicate: "Says they were charged twice",
  subscription_canceled: "Says they had cancelled",
  general: "General dispute",
};
export const reasonText = (r) => DISPUTE_REASONS[r] || "Dispute";

// Open = still needs (or is waiting on) a decision.
export const OPEN_STATUSES = ["warning_needs_response", "needs_response", "under_review", "warning_under_review"];

const STATUS_TEXT = {
  warning_needs_response: "Inquiry: needs a response",
  warning_under_review: "Inquiry under review",
  warning_closed: "Inquiry closed",
  needs_response: "Needs a response",
  under_review: "Under review by the bank",
  won: "Won: the deposit stays",
  lost: "Lost: the deposit went back to the client",
};
export const statusText = (s) => STATUS_TEXT[s] || s || "Open";

const stripeLink = (id, live) => `https://dashboard.stripe.com/${live ? "" : "test/"}disputes/${id}`;

// The evidence Clientele has for a booking, as [label, value] rows.
export function evidenceRows(booking, business) {
  if (!booking) return [["Booking", "Not found in Clientele (the payment may not be a deposit)."]];
  return [
    ["Business", business || "—"],
    ["Client", `${booking.client_name} · ${booking.client_email || "no email"} · ${booking.client_phone || "no phone"}`],
    ["Booked for", `${booking.service_name} on ${formatDate(booking.booking_date)} at ${clockTime(booking.start_time)}`],
    ["Booked on", booking.created_at ? new Date(booking.created_at).toLocaleString("en-US", { timeZone: "America/Chicago" }) + " (Central)" : "—"],
    ["Deposit paid", booking.deposit_paid_at ? new Date(booking.deposit_paid_at).toLocaleString("en-US", { timeZone: "America/Chicago" }) + " (Central)" : "—"],
    ["Booking status", booking.status === "cancelled" ? "Cancelled" : "Confirmed"],
    ["How the visit went", booking.outcome ? outcomeLabel(booking.outcome) : "Not marked"],
    ["Policy the client agreed to", booking.cancellation_policy || "(no policy text was set)"],
    ["Confirmation", "The client confirmed their email with a one-time code and was emailed a booking confirmation."],
  ];
}

// Called by the webhook for charge.dispute.created / .updated / .closed.
// Never throws (a webhook retry won't help an email that failed).
export async function handleDispute(dispute, eventType) {
  try {
    const admin = createAdminClient();
    const paymentIntent = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
    const { data: booking } = paymentIntent
      ? await admin
          .from("bookings")
          .select(
            "id, stylist_id, client_name, client_email, client_phone, service_name, booking_date, start_time, status, outcome, deposit_cents, deposit_paid_at, cancellation_policy, created_at, stylist:stylists(business_name)"
          )
          .eq("stripe_payment_intent_id", paymentIntent)
          .maybeSingle()
      : { data: null };

    const row = {
      id: dispute.id,
      booking_id: booking?.id || null,
      stylist_id: booking?.stylist_id || null,
      payment_intent_id: paymentIntent || null,
      amount_cents: dispute.amount || 0,
      reason: dispute.reason || null,
      status: dispute.status || null,
      evidence_due_by: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await admin.from("deposit_disputes").upsert(row);
    if (error) console.error("Couldn't save dispute (run 0044_disputes.sql?)", error.message);

    // Emails: a new dispute, and the final result.
    const closed = eventType === "charge.dispute.closed";
    if (eventType !== "charge.dispute.created" && !closed) return "saved";
    if (!emailConfigured()) return "saved";

    const business = booking?.stylist?.business_name || "";
    const amount = formatPrice(dispute.amount || 0);
    const due = row.evidence_due_by
      ? new Date(row.evidence_due_by).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : "soon";
    const live = Boolean(dispute.livemode);
    const evidence = evidenceRows(booking, business);
    const evidenceHtml = evidence.map(([k, v]) => `<p><strong>${escapeHtml(k)}</strong><br>${escapeHtml(v)}</p>`).join("");
    const evidenceText = evidence.map(([k, v]) => `${k}: ${v}`).join("\n");
    const messages = [];

    for (const to of adminEmails()) {
      messages.push(
        closed
          ? {
              to,
              subject: `Dispute ${dispute.status === "won" ? "won" : "lost"}: ${amount} deposit${business ? ` (${business})` : ""}`,
              html: emailLayout(`Dispute ${dispute.status === "won" ? "won" : "lost"}`, [
                `<p>${escapeHtml(statusText(dispute.status))}. ${escapeHtml(amount)} · ${escapeHtml(reasonText(dispute.reason))}.</p>`,
                dispute.status === "lost"
                  ? `<p>To take the deposit back from the pro, open the payment in Stripe and use <strong>Reverse transfer</strong>.</p>`
                  : "",
                `<p><a href="${stripeLink(dispute.id, live)}">Open the dispute in Stripe</a></p>`,
              ]),
              text: `${statusText(dispute.status)}. ${amount} · ${reasonText(dispute.reason)}.\nStripe: ${stripeLink(dispute.id, live)}`,
            }
          : {
              to,
              subject: `Deposit disputed: ${amount}${business ? ` (${business})` : ""}, respond by ${due}`,
              html: emailLayout("A client disputed a deposit", [
                `<p><strong>${escapeHtml(amount)}</strong> · ${escapeHtml(reasonText(dispute.reason))}. Respond in Stripe by <strong>${escapeHtml(due)}</strong>, or it's lost automatically.</p>`,
                `<p>Stripe holds the amount plus a $15 fee from Clientele's balance until it's decided.</p>`,
                `<h3>Evidence from Clientele</h3>`,
                evidenceHtml,
                `<p><a href="${stripeLink(dispute.id, live)}">Open the dispute in Stripe</a> · Submit the booking details, the policy the client agreed to, and anything the pro sends you.</p>`,
              ]),
              text: `${amount} · ${reasonText(dispute.reason)}. Respond by ${due}.\n\n${evidenceText}\n\nStripe: ${stripeLink(dispute.id, live)}`,
            }
      );
    }

    // The pro: what happened and how to help.
    if (booking?.stylist_id) {
      const proEmail = (await stylistEmails(admin, [booking.stylist_id]))[booking.stylist_id];
      const replyTo = adminEmails()[0];
      if (proEmail) {
        messages.push(
          closed
            ? {
                to: proEmail,
                replyTo,
                subject: `Update on ${booking.client_name}'s disputed deposit`,
                html: emailLayout("Dispute decided", [
                  `<p>${escapeHtml(booking.client_name)}'s ${escapeHtml(amount)} deposit dispute is closed: <strong>${escapeHtml(
                    statusText(dispute.status)
                  )}</strong>.</p>`,
                  dispute.status === "lost"
                    ? `<p>The bank sided with the client, so the deposit was returned to them and is taken back from your Stripe balance. Reply if you have questions.</p>`
                    : `<p>The deposit stays with you. Nothing else to do.</p>`,
                ]),
                text: `${booking.client_name}'s ${amount} deposit dispute is closed: ${statusText(dispute.status)}.`,
              }
            : {
                to: proEmail,
                replyTo,
                subject: `${booking.client_name} disputed their ${amount} deposit`,
                html: emailLayout("A client disputed a deposit", [
                  `<p>${escapeHtml(booking.client_name)} asked their bank to reverse the ${escapeHtml(amount)} deposit for ${escapeHtml(
                    booking.service_name
                  )} on ${escapeHtml(formatDate(booking.booking_date))}. Reason given: ${escapeHtml(reasonText(dispute.reason))}.</p>`,
                  `<p><strong>Clientele will respond to the bank for you</strong> with the booking details and the cancellation policy they agreed to. If you have anything else (texts with the client, photos, proof they came or didn't), <strong>reply to this email by ${escapeHtml(
                    due
                  )}</strong>.</p>`,
                  `<p>Please don't refund this deposit in the meantime: the bank is already holding it.</p>`,
                ]),
                text: `${booking.client_name} disputed their ${amount} deposit (${reasonText(dispute.reason)}). Clientele will respond with the booking details and policy. Reply with anything else that helps by ${due}. Please don't refund it meanwhile.`,
              }
        );
      }
    }

    if (messages.length) await sendEmails(messages);
    return "emailed";
  } catch (error) {
    console.error("Dispute handling failed", error);
    return "failed";
  }
}

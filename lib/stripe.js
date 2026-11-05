// Stripe helpers for deposits. Server code only.
//
// How the money moves (Stripe Connect "destination charges"): the client pays
// on Stripe's own checkout page, and Stripe sends the deposit straight to the
// stylist's own Stripe account.
import Stripe from "stripe";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { clockTime, formatDate } from "@/lib/availability";
import { DEPOSIT_FEE_FIXED_CENTS, DEPOSIT_FEE_PERCENT } from "@/lib/plans";

// Clientele's fee on a deposit, in cents: 3% + 30 cents ($20.00 -> 90 cents).
export function depositFeeCents(depositCents) {
  const fee = Math.round((depositCents * DEPOSIT_FEE_PERCENT) / 100) + DEPOSIT_FEE_FIXED_CENTS;
  return Math.max(0, Math.min(depositCents, fee));
}

let stripeClient;

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set in Vercel.");
  stripeClient ??= new Stripe(key);
  return stripeClient;
}

// True when the keys deposits need are in Vercel.
export function paymentsConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.SUPABASE_SECRET_KEY);
}

// "https://your-app.vercel.app", for links back from Stripe.
export async function siteOrigin() {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

// Stripe's page stays open for 31 minutes (Stripe's minimum is 30). The
// database holds the time for 35, so a last-second payment still counts.
const CHECKOUT_MINUTES = 31;

// True while the app uses Stripe test keys.
export function stripeTestMode() {
  return String(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_");
}

// Opens a Stripe payment page for a booking waiting on its deposit.
// Returns the page's address. If it fails, it releases the time and throws.
// claimToken: set when the time was claimed from a waitlist message. The
// client may not be logged in on this phone, so the link proves it's theirs
// if they leave the payment page.
// invite: their invite link's secret, so it still works if they come back.
export async function createDepositCheckout(bookingId, origin, { claimToken, invite } = {}) {
  const admin = createAdminClient();
  const { data: booking, error: lookupError } = await admin
    .from("bookings")
    .select(
      "id, service_name, booking_date, start_time, deposit_cents, client_email, status, stylist:stylists(business_name, slug, stripe_account_id)"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (lookupError) throw new Error(`Loading the booking from Supabase failed: ${lookupError.message}`);
  if (!booking) throw new Error("Booking not found in Supabase.");
  if (booking.status !== "pending_payment") throw new Error(`Booking is ${booking.status}.`);
  if (!booking.stylist?.stripe_account_id) throw new Error("The stylist has no Stripe account.");

  const { slug, business_name, stripe_account_id } = booking.stylist;
  const when = `${formatDate(booking.booking_date)} at ${clockTime(booking.start_time)}`;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      // Which ways to pay (cards, Apple Pay...) are chosen in the Stripe
      // Dashboard: Settings -> Payment methods. Keep slow bank payments off
      // there, because they can take days to clear (see DEPOSITS_SETUP.md).
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: booking.deposit_cents,
            product_data: {
              name: `Deposit: ${booking.service_name} with ${business_name}`,
              description: when,
            },
          },
        },
      ],
      // Clients who confirmed by text may not have given an email; Stripe
      // then asks for one on the payment page.
      customer_email: booking.client_email || undefined,
      client_reference_id: booking.id,
      metadata: { booking_id: booking.id },
      payment_intent_data: {
        description: `Deposit: ${booking.service_name}, ${when}`,
        metadata: { booking_id: booking.id },
        // Passed straight on to the stylist's own Stripe account, minus
        // Clientele's fee (lib/plans.js), which helps cover the card costs
        // Clientele pays on each deposit.
        transfer_data: { destination: stripe_account_id },
        application_fee_amount: depositFeeCents(booking.deposit_cents),
      },
      expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60,
      success_url: `${origin}/book/${slug}/paid?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/book/${slug}/unpaid?booking=${booking.id}${
        claimToken ? `&t=${encodeURIComponent(claimToken)}` : ""
      }${invite ? `&invite=${encodeURIComponent(invite)}` : ""}`,
    });

    const { error } = await admin
      .from("bookings")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", booking.id);
    if (error) {
      // Without the link to this payment page, a payment couldn't confirm
      // the booking, so close the page instead.
      await getStripe().checkout.sessions.expire(session.id);
      throw error;
    }

    return session.url;
  } catch (error) {
    await admin.rpc("release_deposit_hold", { p_booking_id: booking.id, p_session_id: null });
    throw error;
  }
}

function paymentIntentId(session) {
  const pi = session.payment_intent;
  return typeof pi === "string" ? pi : pi?.id || null;
}

// Stripe says a payment page was paid: confirm the booking. If the time was
// given away meanwhile (very rare), refund the deposit automatically.
// Safe to run more than once for the same payment.
// Returns 'confirmed', 'already_confirmed', 'refunded', 'unpaid' or 'not_found'.
export async function finalizeCheckoutSession(session) {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) return "not_found";
  if (session.payment_status !== "paid") return "unpaid";

  const admin = createAdminClient();
  const piId = paymentIntentId(session);
  const { data: outcome, error } = await admin.rpc("confirm_deposit_payment", {
    p_booking_id: bookingId,
    p_session_id: session.id,
    p_payment_intent_id: piId,
  });
  if (error) throw new Error(`confirm_deposit_payment failed: ${error.message}`);

  if (outcome === "refund") {
    await getStripe().refunds.create(
      {
        payment_intent: piId,
        // Takes the money back from the stylist's account too.
        reverse_transfer: true,
        metadata: { booking_id: bookingId, reason: "time_no_longer_available" },
      },
      { idempotencyKey: `deposit-refund-${bookingId}` }
    );
    await admin.rpc("mark_deposit_refunded", { p_booking_id: bookingId });
    return "refunded";
  }
  if (outcome === "already_refunded") return "refunded";
  return outcome;
}

// The client didn't pay: free up the time.
export async function releaseCheckoutSession(session) {
  const bookingId = session.metadata?.booking_id;
  if (!bookingId) return;
  const admin = createAdminClient();
  await admin.rpc("release_deposit_hold", { p_booking_id: bookingId, p_session_id: session.id });
}

// "Pay your deposit" for a standing visit that's already booked (the link
// in its emails). token: the booking's cancel_token. Returns the payment
// page's address, reusing one that's still open. Paying marks the deposit
// paid (confirm_deposit_payment); not paying changes nothing.
export async function createStandingDepositCheckout(token, origin) {
  const admin = createAdminClient();
  const { data: booking, error: lookupError } = await admin
    .from("bookings")
    .select(
      "id, service_name, booking_date, start_time, deposit_cents, deposit_status, client_email, status, standing_series_id, stripe_checkout_session_id, stylist:stylists(business_name, slug, stripe_account_id, stripe_charges_enabled)"
    )
    .eq("cancel_token", token)
    .maybeSingle();

  if (lookupError) throw new Error(`Loading the booking from Supabase failed: ${lookupError.message}`);
  if (!booking) throw new Error("Booking not found in Supabase.");
  if (booking.status !== "confirmed" || booking.deposit_status !== "unpaid" || !booking.deposit_cents) {
    throw new Error("This visit has no deposit to pay.");
  }
  if (!booking.stylist?.stripe_account_id || !booking.stylist.stripe_charges_enabled) {
    throw new Error("The stylist can't take card payments right now.");
  }

  const stripe = getStripe();
  // A payment page from an earlier tap that's still open: use it, so a
  // payment on either page counts.
  if (booking.stripe_checkout_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(booking.stripe_checkout_session_id);
      if (existing.status === "open" && existing.url) return existing.url;
      if (existing.payment_status === "paid") {
        await finalizeCheckoutSession(existing);
        return `${origin}/book/${booking.stylist.slug}/paid?session_id=${existing.id}`;
      }
    } catch (error) {
      console.error("Couldn't check the earlier payment page", error.message);
    }
  }

  const { slug, business_name, stripe_account_id } = booking.stylist;
  const when = `${formatDate(booking.booking_date)} at ${clockTime(booking.start_time)}`;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: booking.deposit_cents,
          product_data: {
            name: `Deposit: ${booking.service_name} with ${business_name}`,
            description: when,
          },
        },
      },
    ],
    customer_email: booking.client_email || undefined,
    client_reference_id: booking.id,
    metadata: { booking_id: booking.id },
    payment_intent_data: {
      description: `Deposit: ${booking.service_name}, ${when}`,
      metadata: { booking_id: booking.id },
      transfer_data: { destination: stripe_account_id },
      application_fee_amount: depositFeeCents(booking.deposit_cents),
    },
    expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60,
    success_url: `${origin}/book/${slug}/paid?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/book/${slug}/pay?t=${encodeURIComponent(token)}`,
  });

  // Only while it's still unpaid, so a payment that just landed isn't lost.
  const { data: saved, error } = await admin
    .from("bookings")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", booking.id)
    .eq("deposit_status", "unpaid")
    .select("id");
  if (error || !saved?.length) {
    await stripe.checkout.sessions.expire(session.id);
    throw error || new Error("This visit has no deposit to pay.");
  }
  return session.url;
}

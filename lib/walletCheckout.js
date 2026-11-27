// Apple Pay / Google Pay on our own page for deposits and gift cards
// (/pay/c/[session]). The Stripe payment page (a Checkout Session) is still
// made first, as before, and stays the "Pay with card" fallback. A wallet
// payment is a PaymentIntent for the same amount, paid to the same pro with
// the same fee, tagged with the Checkout Session it stands in for; once it
// succeeds it's recorded exactly as that page's payment would be, and the
// page is closed so it can't be paid twice. Server only.
import { createAdminClient } from "@/lib/supabase/admin";
import { depositFeeCents, finalizeCheckoutSession, getStripe } from "@/lib/stripe";
import { finalizeGiftSession } from "@/lib/giftCards";
export { paymentPageUrl, walletsEnabled } from "@/lib/walletPage";

const SESSION = /^cs_(live|test)_[A-Za-z0-9]{10,200}$/;
// The Checkout Session and whose it is. null for anything else.
export async function loadWalletCheckout(sessionId) {
  if (!SESSION.test(String(sessionId || ""))) return null;
  let session;
  try {
    session = await getStripe().checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  } catch {
    return null;
  }
  const admin = createAdminClient();
  const cols = "business_name, slug, stripe_account_id, stripe_charges_enabled, cover_photo_url";
  let kind = null;
  let stylist = null;
  if (session.metadata?.booking_id) {
    const { data } = await admin
      .from("bookings")
      .select(`id, stripe_checkout_session_id, stylist:stylists(${cols})`)
      .eq("id", session.metadata.booking_id)
      .maybeSingle();
    if (data?.stripe_checkout_session_id !== session.id) return null;
    kind = "deposit";
    stylist = data.stylist;
  } else if (session.metadata?.gift_card_id) {
    const { data } = await admin
      .from("gift_cards")
      .select(`id, checkout_session_id, stylist:stylists(${cols})`)
      .eq("id", session.metadata.gift_card_id)
      .maybeSingle();
    if (data?.checkout_session_id !== session.id) return null;
    kind = "gift";
    stylist = data.stylist;
  }
  if (!kind || !stylist) return null;
  const item = session.line_items?.data?.[0];
  return {
    session,
    kind,
    stylist,
    amountCents: session.amount_total,
    title: item?.description || (kind === "gift" ? "Gift card" : "Deposit"),
  };
}

// The success page Stripe would have sent them to.
export const successUrl = (session) => String(session.success_url || "").replace("{CHECKOUT_SESSION_ID}", session.id);

// The wallet was tapped: a PaymentIntent standing in for the open page.
export async function startCheckoutWallet(sessionId) {
  const c = await loadWalletCheckout(sessionId);
  if (!c) throw new Error("not_found");
  if (c.session.status !== "open") throw new Error(c.session.status === "complete" ? "paid" : "expired");
  if (!c.stylist.stripe_account_id) throw new Error("no_payouts");
  const metadata = { ...c.session.metadata, checkout_session: c.session.id };
  const intent = await getStripe().paymentIntents.create({
    amount: c.amountCents,
    currency: "usd",
    automatic_payment_methods: { enabled: true },
    description: `${c.stylist.business_name}: ${c.title}`,
    metadata,
    transfer_data: { destination: c.stylist.stripe_account_id },
    application_fee_amount: depositFeeCents(c.amountCents),
    ...(c.session.customer_email ? { receipt_email: c.session.customer_email } : {}),
  });
  return { clientSecret: intent.client_secret };
}

/**
 * A wallet PaymentIntent succeeded (from the page or the webhook): record it
 * as its Checkout Session's payment, then close that page. Safe twice.
 * Returns the outcome ('confirmed', 'already_confirmed', 'refunded',
 * 'active', 'already', 'unpaid' or 'not_found').
 */
export async function finalizeCheckoutWallet(intent) {
  const sessionId = intent?.metadata?.checkout_session;
  if (!SESSION.test(String(sessionId || ""))) return "not_found";
  if (intent.status !== "succeeded") return "unpaid";
  // Shaped like the paid Checkout Session it stands in for.
  const paid = { id: sessionId, metadata: intent.metadata, payment_status: "paid", payment_intent: intent.id };
  let outcome = "not_found";
  if (intent.metadata.booking_id) outcome = await finalizeCheckoutSession(paid);
  else if (intent.metadata.gift_card_id) outcome = await finalizeGiftSession(paid);
  if (outcome !== "not_found") {
    await getStripe()
      .checkout.sessions.expire(sessionId)
      .catch(() => {});
  }
  return outcome;
}

// From the page: check the PaymentIntent really is this page's, then record it.
export async function finishCheckoutWallet(sessionId, intentId) {
  if (!SESSION.test(String(sessionId || "")) || !/^pi_[A-Za-z0-9]+$/.test(String(intentId || ""))) return null;
  const intent = await getStripe().paymentIntents.retrieve(intentId);
  if (intent.metadata?.checkout_session !== sessionId) return null;
  return finalizeCheckoutWallet(intent);
}

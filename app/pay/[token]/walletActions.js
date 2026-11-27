"use server";

// The payment page's Apple Pay / Google Pay buttons (WalletPay.js): make the
// PaymentIntent once the client taps, then record it once Stripe says paid.
import { getStripe } from "@/lib/stripe";
import { createPaymentLinkIntent, finalizePaymentLinkIntent, loadPaymentLink } from "@/lib/paymentLinksServer";

export async function startWalletPayment(token) {
  try {
    return await createPaymentLinkIntent(String(token || ""));
  } catch (error) {
    return { error: error.message || "failed" };
  }
}

export async function finishWalletPayment(token, intentId) {
  const link = await loadPaymentLink(String(token || ""));
  if (!link || !/^pi_[A-Za-z0-9]+$/.test(String(intentId || ""))) return { error: "not_found" };
  if (link.status === "paid") return { status: "paid" };
  try {
    const intent = await getStripe().paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
    if (intent.metadata?.payment_link_id !== link.id) return { error: "not_found" };
    const outcome = await finalizePaymentLinkIntent(intent);
    return { status: outcome === "already" ? "paid" : outcome };
  } catch {
    // The webhook records it.
    return { status: "pending" };
  }
}

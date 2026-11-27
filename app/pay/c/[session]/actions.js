"use server";

// The wallet buttons on a deposit or gift card payment page (page.js).
import { redirect } from "next/navigation";
import { finishCheckoutWallet, loadWalletCheckout, startCheckoutWallet, successUrl, switchToPayLater } from "@/lib/walletCheckout";

export async function startCheckoutPayment(sessionId) {
  try {
    return await startCheckoutWallet(String(sessionId || ""));
  } catch (error) {
    return { error: error.message || "failed" };
  }
}

// Recorded: on to the same "You're booked" / "Gift card sent" page as a card payment.
export async function finishCheckoutPayment(sessionId, intentId) {
  try {
    await finishCheckoutWallet(String(sessionId || ""), String(intentId || ""));
  } catch {
    // The webhook records it.
  }
  const c = await loadWalletCheckout(String(sessionId || ""));
  return c ? { url: successUrl(c.session) } : null;
}

// "Pay over time" on a deposit: on to the Klarna / Afterpay / Affirm page.
export async function payLaterDeposit(formData) {
  const sessionId = String(formData.get("session") || "");
  let url;
  try {
    url = await switchToPayLater(sessionId);
  } catch (error) {
    redirect(`/pay/c/${encodeURIComponent(sessionId)}?problem=${encodeURIComponent(error.message || "failed")}`);
  }
  redirect(url);
}

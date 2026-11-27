// Apple Pay / Google Pay for deposits and gift cards (lib/walletCheckout.js,
// /pay/c/[session]). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { paymentPageUrl, walletsEnabled } from "../lib/walletPage.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const session = { id: "cs_live_abc123DEF456ghi", url: "https://checkout.stripe.com/c/pay/cs_live_abc" };

test("with the publishable key, clients pay on our page; without it, on Stripe's as before", () => {
  const was = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  try {
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    assert.equal(walletsEnabled(), false);
    assert.equal(paymentPageUrl("https://www.clientelesuite.com", session), session.url);
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_live_x";
    assert.equal(paymentPageUrl("https://www.clientelesuite.com", session), "https://www.clientelesuite.com/pay/c/cs_live_abc123DEF456ghi");
  } finally {
    if (was === undefined) delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = was;
  }
});

test("deposits (new and standing) and gift cards all go through the wallet page", () => {
  const stripe = read("lib/stripe.js");
  assert.doesNotMatch(stripe, /return session\.url;/);
  assert.match(stripe, /return paymentPageUrl\(origin, existing\)/);
  assert.doesNotMatch(read("lib/giftCards.js"), /return session\.url;/);
});

test("a wallet payment goes to the same pro with the same fee, tagged with its Stripe page", () => {
  const lib = read("lib/walletCheckout.js");
  const start = lib.slice(lib.indexOf("export async function startCheckoutWallet"), lib.indexOf("export async function finalizeCheckoutWallet"));
  assert.match(start, /transfer_data: \{ destination: c\.stylist\.stripe_account_id \}/);
  assert.match(start, /application_fee_amount: depositFeeCents\(c\.amountCents\)/);
  assert.match(start, /checkout_session: c\.session\.id/);
  assert.match(start, /status !== "open"/);
});

test("a wallet payment confirms the booking or gift card, then closes the Stripe page so it can't be paid twice", () => {
  const lib = read("lib/walletCheckout.js");
  const fin = lib.slice(lib.indexOf("export async function finalizeCheckoutWallet"));
  assert.match(fin, /finalizeCheckoutSession\(paid\)/);
  assert.match(fin, /finalizeGiftSession\(paid\)/);
  assert.match(fin, /sessions\s*\.expire\(sessionId\)/);
  assert.match(read("app/api/stripe/webhook/route.js"), /payment_intent\.succeeded" && object\.metadata\?\.checkout_session/);
});

test("the deposit paid page says booked after a wallet payment closed Stripe's page", () => {
  assert.match(read("app/book/[slug]/paid/page.js"), /outcome === "unpaid" && booking\.deposit_status === "paid"/);
});

test("no wallet on the device: straight on to Stripe's page", () => {
  const w = read("components/pay/WalletButtons.js");
  assert.match(w, /if \(!any && fallbackUrl\) window\.location\.replace\(fallbackUrl\)/);
  assert.match(read("app/pay/c/[session]/page.js"), /fallbackUrl=\{session\.url\}/);
});

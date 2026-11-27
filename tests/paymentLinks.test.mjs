// Payment links (lib/paymentLinks.js) and their share message (lib/shareTargets.js). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkLink, linkPaymentKind, linkFeeCents, linkShareText, LINK_MIN_CENTS, LINK_MAX_CENTS, newLinkToken } from "../lib/paymentLinks.js";
import { shareTargets } from "../lib/shareTargets.js";

test("amount and what it's for are required; $1 to $10,000", () => {
  assert.equal(LINK_MIN_CENTS, 100);
  assert.equal(LINK_MAX_CENTS, 1000000);
  assert.deepEqual(checkLink({ amount: "60", description: "Balance for silk press" }), { amountCents: 6000, description: "Balance for silk press", clientName: "" });
  assert.equal(checkLink({ amount: "$42.50", description: "Braiding hair", clientName: " Maya " }).amountCents, 4250);
  assert.equal(checkLink({ amount: "42.50", description: "x", clientName: " Maya " }).clientName, "Maya");
  assert.match(checkLink({ amount: "", description: "x" }).error, /amount/i);
  assert.match(checkLink({ amount: "0.50", description: "x" }).error, /\$1/);
  assert.match(checkLink({ amount: "20000", description: "x" }).error, /10,000/);
  assert.match(checkLink({ amount: "20", description: "  " }).error, /what it's for/i);
});

test("what it's for is one line, at most 120 characters", () => {
  assert.equal(checkLink({ amount: "5", description: "a\n  b" }).description, "a b");
  assert.equal(checkLink({ amount: "5", description: "x".repeat(200) }).description.length, 120);
});

test("the fee is the same as deposits: 3% + 30 cents", () => {
  assert.equal(linkFeeCents(6000), 210);
  assert.equal(linkFeeCents(1000), 60);
});

test("a link for a visit's balance records as a balance payment; anything else as other income", () => {
  assert.equal(linkPaymentKind({ booking_id: "b1" }), "balance");
  assert.equal(linkPaymentKind({ booking_id: null }), "other");
});

test("link codes are long and unguessable", () => {
  const a = newLinkToken();
  assert.match(a, /^[A-Za-z0-9_-]{22,}$/);
  assert.notEqual(a, newLinkToken());
});

test("the share message says who, how much and what for", () => {
  assert.equal(linkShareText("Studio Sam", 6000, "Balance for silk press"), "Studio Sam: $60.00 for Balance for silk press. Pay here:");
});

test("share targets can carry a payment message instead of 'Book with'", () => {
  const t = Object.fromEntries(shareTargets("https://x.com/pay/abc", "Studio Sam", "Studio Sam: $60.00 for Trim. Pay here:").map((x) => [x.key, x]));
  assert.equal(t.sms.href, `sms:?&body=${encodeURIComponent("Studio Sam: $60.00 for Trim. Pay here: https://x.com/pay/abc")}`);
  const d = Object.fromEntries(shareTargets("https://x.com/book/s", "Studio Sam").map((x) => [x.key, x]));
  assert.match(decodeURIComponent(d.sms.href), /Book with Studio Sam: https:\/\/x\.com\/book\/s/);
});

// The redesigned payment page (own look, on-page wallets) and the webhook
// that records a wallet payment.
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the payment page has its own look, not the booking page's cover photo", () => {
  assert.doesNotMatch(read("app/pay/layout.js"), /book\/layout/);
  assert.doesNotMatch(read("app/pay/[token]/page.js"), /StylistShell/);
  assert.match(read("app/pay/layout.js"), /pay\.css/);
});

test("Apple Pay / Google Pay on the page, with Pay with card always there", () => {
  const page = read("app/pay/[token]/page.js");
  assert.match(page, /<WalletPay /);
  assert.match(page, /with card/);
  const wallet = read("app/pay/[token]/WalletPay.js");
  assert.match(wallet, /expressCheckout/);
  assert.match(wallet, /NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY/);
});

test("a wallet payment is recorded by the webhook and paid to the pro", () => {
  const hook = read("app/api/stripe/webhook/route.js");
  assert.match(hook, /payment_intent\.succeeded" && object\.metadata\?\.payment_link_id/);
  const server = read("lib/paymentLinksServer.js");
  const create = server.slice(server.indexOf("export async function createPaymentLinkIntent"));
  assert.match(create, /transfer_data: \{ destination: s\.stripe_account_id \}/);
  assert.match(create, /application_fee_amount: linkFeeCents\(link\.amount_cents\)/);
  assert.match(create, /metadata: \{ payment_link_id: link\.id \}/);
});

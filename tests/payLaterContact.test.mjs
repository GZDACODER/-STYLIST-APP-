// Pay over time (lib/payLater.js) and the booking page's Contact section
// (lib/profileLinks.js). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { payLaterFeeCents, payLaterNames, payLaterTypes, PAY_LATER_TYPES } from "../lib/payLater.js";
import { cleanContactEmail, cleanFacebook, cleanPhone, facebookUrl, mapEmbedUrl } from "../lib/profileLinks.js";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("pay over time: $50 and up, only methods that take the amount", () => {
  assert.deepEqual(payLaterTypes(4999), []);
  assert.deepEqual(payLaterTypes(5000), ["klarna", "afterpay_clearpay", "affirm"]);
  assert.deepEqual(payLaterTypes(500000), ["klarna", "affirm"]); // Afterpay stops at $4,000
  assert.deepEqual(payLaterTypes(30000, ["klarna"]), ["klarna"]); // only what's on in Stripe
  assert.deepEqual(payLaterTypes(30000, []), []);
  assert.equal(payLaterNames(["klarna", "afterpay_clearpay", "affirm"]), "Klarna, Afterpay or Affirm");
  assert.equal(payLaterNames(["klarna"]), "Klarna");
});

test("pay over time has its own fee: 6% + 30 cents", () => {
  assert.equal(payLaterFeeCents(10000), 630);
  assert.equal(payLaterFeeCents(30000), 1830);
});

test("every regular Stripe page leaves pay over time out, so 3% + 30 cents always covers it", () => {
  assert.equal((read("lib/stripe.js").match(/excluded_payment_method_types: PAY_LATER_TYPES/g) || []).length, 2);
  assert.match(read("lib/giftCards.js"), /excluded_payment_method_types: PAY_LATER_TYPES/);
  assert.match(read("lib/paymentLinksServer.js"), /payLater \? \{ payment_method_types: later \} : \{ excluded_payment_method_types: PAY_LATER_TYPES \}/);
  assert.match(read("lib/paymentLinksServer.js"), /payLater \? payLaterFeeCents\(link\.amount_cents\) : linkFeeCents/);
  assert.match(read("lib/walletCheckout.js"), /application_fee_amount: payLaterFeeCents\(c\.amountCents\)/);
});

test("a deposit switched to pay over time moves the booking to the new page, then closes the old one", () => {
  const w = read("lib/walletCheckout.js");
  const fn = w.slice(w.indexOf("export async function switchToPayLater"));
  assert.match(fn, /\.eq\("stripe_checkout_session_id", old\.id\)/);
  assert.ok(fn.indexOf("update({ stripe_checkout_session_id: session.id })") < fn.indexOf("sessions.expire(old.id)"));
  assert.match(fn, /c\.kind !== "deposit"/); // never gift cards
});

test("contact details: Facebook, phone and email are checked", () => {
  assert.equal(cleanFacebook("https://www.facebook.com/iheartink/"), "iheartink");
  assert.equal(facebookUrl("facebook.com/profile.php?id=12345"), "https://www.facebook.com/profile.php?id=12345");
  assert.equal(cleanFacebook(""), "");
  assert.equal(cleanFacebook("no"), null);
  assert.equal(cleanPhone(" (312) 555-0142 "), "(312) 555-0142");
  assert.equal(cleanPhone("call me"), null);
  assert.equal(cleanContactEmail(" Ink@Example.com "), "ink@example.com");
  assert.equal(cleanContactEmail("nope"), null);
});

test("the map is only for a typed address, and only when the pro turns it on", () => {
  assert.equal(mapEmbedUrl("2351 W North Ave, Chicago"), "https://www.google.com/maps?q=2351%20W%20North%20Ave%2C%20Chicago&output=embed");
  assert.equal(mapEmbedUrl("https://maps.app.goo.gl/abc"), null);
  assert.match(read("app/book/[slug]/ContactSection.js"), /header\.show_map \? mapEmbedUrl\(where\) : null/);
  assert.match(read("supabase/migrations/0082_contact_pay_later.sql"), /show_map boolean not null default false/);
});

test("PAY_LATER_TYPES lists the three methods", () => {
  assert.deepEqual(PAY_LATER_TYPES, ["klarna", "afterpay_clearpay", "affirm"]);
});

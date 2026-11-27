// The share menu's options for a booking link (lib/shareTargets.js). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { shareTargets, shareText } from "../lib/shareTargets.js";

const URL_ = "https://www.clientelesuite.com/book/studio-sam";

test("the message names the business and carries the link", () => {
  assert.equal(shareText("Studio Sam", URL_), `Book with Studio Sam: ${URL_}`);
});

test("options in order: Messages, Instagram, Facebook, TikTok, WhatsApp, Email, Copy link", () => {
  assert.deepEqual(shareTargets(URL_, "Studio Sam").map((t) => t.key), ["sms", "instagram", "facebook", "tiktok", "whatsapp", "email", "copy"]);
});

test("Messages, WhatsApp, Facebook and Email open with the link filled in", () => {
  const t = Object.fromEntries(shareTargets(URL_, "Studio Sam").map((x) => [x.key, x]));
  const enc = encodeURIComponent(`Book with Studio Sam: ${URL_}`);
  assert.equal(t.sms.href, `sms:?&body=${enc}`);
  assert.equal(t.whatsapp.href, `https://wa.me/?text=${enc}`);
  assert.equal(t.facebook.href, `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(URL_)}`);
  assert.match(t.email.href, /^mailto:\?subject=Book%20with%20Studio%20Sam&body=/);
});

test("Instagram and TikTok can't take a link from the web: copy it, then open the app, with a hint", () => {
  const t = Object.fromEntries(shareTargets(URL_, "Studio Sam").map((x) => [x.key, x]));
  for (const k of ["instagram", "tiktok"]) {
    assert.equal(t[k].copyFirst, true);
    assert.match(t[k].href, /^https:\/\/www\.(instagram|tiktok)\.com\/$/);
    assert.match(t[k].note, /copied/i);
  }
  assert.equal(t.copy.href, undefined);
});

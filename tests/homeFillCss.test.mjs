// Style guards for the Home cards shared by the dashboard and the landing
// page (app/(studio)/dashboard/home/homeFill.css, app/(home)/landing.css).
// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const shared = readFileSync(new URL("../app/(studio)/dashboard/home/homeFill.css", import.meta.url), "utf8");
const landing = readFileSync(new URL("../app/(home)/landing.css", import.meta.url), "utf8");
const ruleFor = (css, selector) => {
  const i = css.indexOf(selector);
  return i < 0 ? null : css.slice(i, css.indexOf("}", i));
};

test("the dashboard card rule outweighs .db .card (stylesheets can load in either order)", () => {
  const rule = ruleFor(shared, ".db .card.hf-card");
  assert.ok(rule, "expected a .db .card.hf-card rule");
  assert.match(rule, /inset 0 0 0 1px rgba\(168, 135, 77, 0\.25\)/);
  assert.match(rule, /margin: 0/);
});

test("the gliding bars are landing-only (the dashboard's bars don't animate on new data)", () => {
  assert.equal(/(^|\n)\s*\.hf-bar-fill\s*\{[^}]*transition/.test(shared), false, "no unscoped .hf-bar-fill transition");
  assert.match(shared, /\.ln \.hf-bar-fill\s*\{[^}]*transition: height/);
});

test("demo buttons are at least 44px tall", () => {
  const rule = ruleFor(landing, ".ln-live .ln-btn");
  assert.ok(rule, "expected a .ln-live .ln-btn rule");
  assert.match(rule, /min-height: 44px/);
});

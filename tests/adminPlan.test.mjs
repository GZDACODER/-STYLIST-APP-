// Admin plan changes and the plan label on the Pros pages (lib/adminPlan.js). Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { foundingTrialEnd, extendTrialEnd, planStatus, FOUNDING_MONTHS } from "../lib/adminPlan.js";

const NOW = Date.parse("2026-11-27T18:00:00Z");
const day = (n) => new Date(NOW + n * 86400000).toISOString();

test("founding pro: 2 months free counted from signup", () => {
  assert.equal(FOUNDING_MONTHS, 2);
  assert.equal(foundingTrialEnd("2026-11-20T10:00:00Z", NOW), "2027-01-20T10:00:00.000Z");
});

test("founding pro long after signup: 2 months from today instead", () => {
  assert.equal(foundingTrialEnd("2026-08-01T10:00:00Z", NOW), "2027-01-27T18:00:00.000Z");
});

test("extend: adds days to the trial end, or to today when it already ended", () => {
  assert.equal(extendTrialEnd(day(5), NOW, 14), day(19));
  assert.equal(extendTrialEnd(day(-3), NOW, 7), day(7));
  assert.equal(extendTrialEnd(null, NOW, 30), day(30));
});

test("plan label: paying, free account, trial (with days left), trial ended", () => {
  assert.equal(planStatus({ base_active: true, billing_interval: "year" }, NOW).key, "paying");
  assert.match(planStatus({ base_active: true, billing_interval: "year" }, NOW).label, /yearly/i);
  assert.equal(planStatus({ comped: true }, NOW).key, "free");
  const t = planStatus({ trial_ends_at: day(9) }, NOW);
  assert.equal(t.key, "trial");
  assert.match(t.label, /9 days left/);
  assert.equal(planStatus({ trial_ends_at: day(-1) }, NOW).key, "ended");
  assert.equal(planStatus(null, NOW).key, "ended");
});

test("a founding pro in their free months says so", () => {
  const s = planStatus({ trial_ends_at: day(40) }, NOW, { founding: true });
  assert.equal(s.key, "trial");
  assert.match(s.label, /^Founding pro · 40 days left/);
});

test("cancelling at period end shows on a paying pro", () => {
  assert.match(planStatus({ base_active: true, billing_interval: "month", cancel_at_period_end: true, current_period_end: day(10) }, NOW).label, /cancels/i);
});

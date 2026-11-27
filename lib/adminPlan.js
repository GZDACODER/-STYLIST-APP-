// Admin changes to a pro's plan (Pros pages, /dashboard/admin/pros), and
// the one-line plan label shown there. Pure; relative imports only.

export const FOUNDING_MONTHS = 2;
const DAY = 86400000;

const addMonths = (ms, n) => {
  const d = new Date(ms);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d;
};

// Founding pro: their free trial runs 2 months from signup; if that's
// already past (made founding late), 2 months from today.
export function foundingTrialEnd(createdAt, now = Date.now()) {
  const fromSignup = addMonths(Date.parse(createdAt), FOUNDING_MONTHS);
  return (fromSignup.getTime() > now ? fromSignup : addMonths(now, FOUNDING_MONTHS)).toISOString();
}

// More free days: added to the trial end, or to today when it has ended.
export function extendTrialEnd(trialEndsAt, now = Date.now(), days = 7) {
  const end = trialEndsAt ? Date.parse(trialEndsAt) : 0;
  return new Date(Math.max(end, now) + days * DAY).toISOString();
}

const shortDate = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

// { key: paying | free | trial | ended, label }
export function planStatus(plan, now = Date.now(), { founding = false } = {}) {
  const p = plan || {};
  if (p.base_active || p.regulars_active || p.waitlist_active) {
    const every = p.billing_interval === "year" ? "Paying yearly" : "Paying monthly";
    const cancels = p.cancel_at_period_end && p.current_period_end ? ` · cancels ${shortDate(p.current_period_end)}` : "";
    return { key: "paying", label: every + cancels };
  }
  if (p.comped) return { key: "free", label: "Free account" };
  if (p.trial_ends_at && Date.parse(p.trial_ends_at) > now) {
    const left = Math.ceil((Date.parse(p.trial_ends_at) - now) / DAY);
    return { key: "trial", label: `${founding ? "Founding pro" : "Free trial"} · ${left} day${left === 1 ? "" : "s"} left (ends ${shortDate(p.trial_ends_at)})` };
  }
  return { key: "ended", label: p.trial_ends_at ? `Trial ended ${shortDate(p.trial_ends_at)} · not paying` : "Not paying" };
}

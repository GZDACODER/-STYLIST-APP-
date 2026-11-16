// Clientele's plan and prices: the one place to change them.
//
// One plan, All-in, with every feature. Team members (staff seats) are
// added at half price each, as a quantity on a second subscription item.
// Amounts are in cents. Yearly = 10 x monthly (2 months free).
//
// Stripe gets one Price per plan and interval, found by its lookup key
// (like "clientele_allin_month"). lib/billing.js makes them the first time
// they're needed; to change a price, change it here (a new Price takes over
// the lookup key). Or set the Price ids in Vercel (STRIPE_PRICE_ALLIN_MONTH,
// STRIPE_PRICE_ALLIN_YEAR, STRIPE_PRICE_TEAM_MONTH, STRIPE_PRICE_TEAM_YEAR)
// to use Prices made by hand. Stylists already paying keep their price until
// you move them.

export const TRIAL_DAYS = 14; // Also in supabase/migrations/0017_plans.sql.

// Clientele's fee on each deposit a client pays (Stripe application fee):
// 3% + 30 cents, so it covers Stripe's card fee (about 2.9% + 30 cents) and
// Clientele breaks even. Never more than the deposit itself.
export const DEPOSIT_FEE_PERCENT = 3;
export const DEPOSIT_FEE_FIXED_CENTS = 30;

// Clientele's fee on a deposit, in cents: 3% + 30 cents ($20.00 -> 90 cents).
export function depositFeeCents(depositCents) {
  const fee = Math.round((depositCents * DEPOSIT_FEE_PERCENT) / 100) + DEPOSIT_FEE_FIXED_CENTS;
  return Math.max(0, Math.min(depositCents, fee));
}

const yearly = (monthlyCents) => monthlyCents * 10;

export const PLANS = {
  allin: {
    name: "All-in",
    description:
      "Everything: booking page, deposits, reminders, Regulars First, standing appointments, the waitlist, notes, reports and portfolio.",
    monthlyCents: 2500,
  },
  team: {
    name: "Team member",
    description: "Each extra person on your team, at half price.",
    monthlyCents: 1250,
    perSeat: true,
  },
  // Optional add-on: the dashboard Assistant (it uses Claude, which costs
  // Clientele per request). Included in the free trial; founding (comped)
  // accounts pay for it too.
  assistant: {
    name: "Assistant",
    description: "Ask about your schedule and make changes in your own words, from a chat on every dashboard page.",
    monthlyCents: 1500,
  },
};

for (const [key, plan] of Object.entries(PLANS)) {
  plan.key = key;
  plan.yearlyCents = yearly(plan.monthlyCents);
  plan.lookupKeys = { month: `clientele_${key}_month`, year: `clientele_${key}_year` };
}

// The old plans (before Nov 2026): $15 base, +$10 Regulars First, +$7
// Waitlist, $29 All-in. Their Prices are archived for new signups; anyone
// already paying keeps theirs, and gets every feature.
export const LEGACY_LOOKUP_KEYS = ["base", "regulars", "waitlist", "bundle"].flatMap((key) => [
  `clientele_${key}_month`,
  `clientele_${key}_year`,
]);

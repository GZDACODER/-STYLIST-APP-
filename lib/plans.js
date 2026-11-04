// Clientele's plans and prices: the one place to change them.
//
// Amounts are in cents. Yearly = 10 x monthly (2 months free).
// Stripe (part 2) gets one Price per plan and interval, found by its
// lookup key (like "clientele_base_month"). To change a price later: change
// it here, then re-run the Stripe setup (part 2) so Stripe gets a new Price
// with the same lookup key. Stylists already paying keep their old price
// until you move them.

export const TRIAL_DAYS = 14; // Also in supabase/migrations/0017_plans.sql.

// Clientele's fee on each deposit a client pays (Stripe application fee),
// so Clientele doesn't pay the card costs. Used from part 2.
export const DEPOSIT_FEE_PERCENT = 2;

const yearly = (monthlyCents) => monthlyCents * 10;

export const PLANS = {
  base: {
    name: "Clientele",
    description:
      "Booking page, cover photo and links, services, hours, openings, calendar, clients, email codes and deposits.",
    monthlyCents: 1500,
    features: ["base"],
  },
  regulars: {
    name: "Regulars First",
    description: "\"Regulars only\" openings, Regulars-only mode and invite links.",
    monthlyCents: 1000,
    features: ["regulars"],
    addOn: true,
  },
  waitlist: {
    name: "Waitlist",
    description: "A waitlist with \"Claim this time\" emails and a head start for Regulars.",
    monthlyCents: 700,
    features: ["waitlist"],
    addOn: true,
  },
  bundle: {
    name: "All-in",
    description: "Clientele plus Regulars First and Waitlist.",
    monthlyCents: 2900,
    features: ["base", "regulars", "waitlist"],
  },
};

for (const [key, plan] of Object.entries(PLANS)) {
  plan.key = key;
  plan.yearlyCents = yearly(plan.monthlyCents);
  plan.lookupKeys = { month: `clientele_${key}_month`, year: `clientele_${key}_year` };
}

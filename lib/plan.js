// The logged-in stylist's plan. Server code only.
//
// { comped, inTrial, trialEndsAt, teamMembers, assistantPaid,
//   has: { base, regulars, waitlist, assistant } }
// One plan (All-in): a free account, a trial or any paid plan has every
// feature, so `has` is all true or all false. Mirrors stylist_has_feature()
// in supabase/migrations/0032_one_plan.sql, which is what enforces it.
const COLUMNS =
  "comped, trial_ends_at, base_active, regulars_active, waitlist_active, billing_interval, stripe_customer_id, stripe_status, current_period_end";

export async function getMyPlan(supabase, userId) {
  // With the team member count (step 27 SQL) and the Assistant add-on
  // (step 33), else without them.
  // Plus the cancel date (step 36 SQL) when it's there.
  let { data, error } = await supabase
    .from("stylist_plans")
    .select(`${COLUMNS}, team_members, assistant_active, cancel_at_period_end, cancel_at`)
    .eq("stylist_id", userId)
    .maybeSingle();
  if (error) {
    ({ data, error } = await supabase
      .from("stylist_plans")
      .select(`${COLUMNS}, team_members, assistant_active`)
      .eq("stylist_id", userId)
      .maybeSingle());
  }
  if (error) {
    ({ data, error } = await supabase
      .from("stylist_plans")
      .select(`${COLUMNS}, team_members`)
      .eq("stylist_id", userId)
      .maybeSingle());
  }
  if (error) {
    ({ data, error } = await supabase.from("stylist_plans").select(COLUMNS).eq("stylist_id", userId).maybeSingle());
  }

  // Before the plans SQL (0017) is run: everything on, as before.
  if (error || !data) {
    return {
      ready: false,
      comped: true,
      subscribed: false,
      hasCustomer: false,
      inTrial: false,
      trialEndsAt: null,
      assistantPaid: false,
      has: { base: true, regulars: true, waitlist: true, assistant: false },
    };
  }

  // Shop accounts (0081 SQL): a chair whose shop pays for them, and how many
  // extra chairs an owner pays for. Nothing before that SQL is run.
  const [{ data: shopCovered }, { data: chairs }] = await Promise.all([
    supabase.rpc("shop_covers", { p_stylist_id: userId }),
    supabase.from("stylist_plans").select("shop_chairs").eq("stylist_id", userId).maybeSingle(),
  ]);

  const inTrial = Boolean(data.trial_ends_at && new Date(data.trial_ends_at) > new Date());
  // Whole days left in the trial, rounded up (ends in 5 hours = 1 day).
  const daysLeft = inTrial
    ? Math.ceil((new Date(data.trial_ends_at).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : 0;
  // Paying for any Clientele plan (All-in, or an older one) = everything.
  const paying = Boolean(data.base_active || data.regulars_active || data.waitlist_active);
  const on = data.comped || inTrial || paying || shopCovered === true;
  return {
    ready: true,
    comped: data.comped,
    inTrial,
    daysLeft,
    trialEndsAt: data.trial_ends_at,
    interval: data.billing_interval,
    // Paying (or retrying a failed payment) with Stripe right now.
    subscribed: ["active", "trialing", "past_due"].includes(data.stripe_status),
    stripeStatus: data.stripe_status,
    hasCustomer: Boolean(data.stripe_customer_id),
    periodEnd: data.current_period_end,
    // Cancelled in Stripe: still on until cancelAt, then it stops (no charge).
    cancelling: Boolean(data.cancel_at_period_end) && ["active", "trialing", "past_due"].includes(data.stripe_status),
    cancelAt: data.cancel_at || data.current_period_end,
    teamMembers: data.team_members || 0,
    // A chair in a shop whose owner pays for them: always on, never billed.
    shopCovered: shopCovered === true,
    // Extra chairs an owner's subscription pays for.
    shopChairs: chairs?.shop_chairs || 0,
    paying,
    // The Assistant add-on: paid for, or free during the trial. Founding
    // (comped) accounts pay for it too.
    assistantPaid: Boolean(data.assistant_active),
    has: { base: on, regulars: on, waitlist: on, assistant: Boolean(data.assistant_active) || inTrial },
  };
}

// The database's "paused" errors, in plain words. null for any other error.
export function planErrorMessage(error) {
  const text = String(error?.message || error || "");
  if (text.includes("plan_regulars_paused") || text.includes("plan_waitlist_paused")) {
    return "Your plan is paused, so this can't be turned on. Choose a plan in Settings to switch everything back on.";
  }
  return null;
}

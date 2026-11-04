// The logged-in stylist's plan: which parts are on. Server code only.
//
// { comped, inTrial, trialEndsAt, has: { base, regulars, waitlist } }
// Mirrors stylist_has_feature() in supabase/migrations/0017_plans.sql, which
// is what actually enforces it.
export async function getMyPlan(supabase, userId) {
  const { data, error } = await supabase
    .from("stylist_plans")
    .select(
      "comped, trial_ends_at, base_active, regulars_active, waitlist_active, billing_interval, stripe_customer_id, stripe_status, current_period_end"
    )
    .eq("stylist_id", userId)
    .maybeSingle();

  // Before the plans SQL (0017) is run: everything on, as before.
  if (error || !data) {
    return {
      ready: false,
      comped: true,
      subscribed: false,
      hasCustomer: false,
      inTrial: false,
      trialEndsAt: null,
      has: { base: true, regulars: true, waitlist: true },
    };
  }

  const inTrial = Boolean(data.trial_ends_at && new Date(data.trial_ends_at) > new Date());
  const all = data.comped || inTrial;
  return {
    ready: true,
    comped: data.comped,
    inTrial,
    trialEndsAt: data.trial_ends_at,
    interval: data.billing_interval,
    // Paying (or retrying a failed payment) with Stripe right now.
    subscribed: ["active", "trialing", "past_due"].includes(data.stripe_status),
    stripeStatus: data.stripe_status,
    hasCustomer: Boolean(data.stripe_customer_id),
    periodEnd: data.current_period_end,
    paid: {
      base: data.base_active,
      regulars: data.base_active && data.regulars_active,
      waitlist: data.base_active && data.waitlist_active,
    },
    has: {
      base: all || data.base_active,
      regulars: all || (data.base_active && data.regulars_active),
      waitlist: all || (data.base_active && data.waitlist_active),
    },
  };
}

// The database's "paused" errors, in plain words. null for any other error.
export function planErrorMessage(error) {
  const text = String(error?.message || error || "");
  if (text.includes("plan_regulars_paused")) {
    return "Regulars First isn't on your plan right now, so this can't be turned on.";
  }
  if (text.includes("plan_waitlist_paused")) {
    return "The Waitlist add-on isn't on your plan right now, so this can't be turned on.";
  }
  return null;
}

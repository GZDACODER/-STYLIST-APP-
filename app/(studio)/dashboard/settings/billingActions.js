"use server";

// Paying for Clientele: opens Stripe's payment page for the plan picked in
// Settings. The plan switches on when Stripe tells the webhook it's paid.
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getMyPlan } from "@/lib/plan";
import { ensureCustomer, ensurePrice, planKeysFor } from "@/lib/billing";
import { paymentsConfigured, getStripe } from "@/lib/stripe";
import { publicSiteUrl } from "@/lib/siteUrl";

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  const proto = h.get("x-forwarded-proto") || "https";
  return publicSiteUrl(`${proto}://${host}`);
}

export async function startCheckout(prevState, formData) {
  if (!paymentsConfigured()) {
    return { error: "Stripe isn't set up for this app yet. Add the Stripe keys in Vercel first." };
  }
  const interval = formData.get("interval") === "year" ? "year" : "month";
  const bundle = formData.get("plan") === "bundle";
  const choice = {
    bundle,
    regulars: !bundle && formData.get("regulars") === "on",
    waitlist: !bundle && formData.get("waitlist") === "on",
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const plan = await getMyPlan(supabase, user.id);
  if (!plan.ready) return { error: "Run supabase/migrations/0017_plans.sql in Supabase first." };
  if (plan.comped) return { error: "Your account is free, so there's nothing to pay." };
  if (plan.subscribed) {
    return { error: "You already have a plan. Use Manage billing to change or cancel it." };
  }

  const { data: stylist } = await supabase
    .from("stylists")
    .select("business_name")
    .eq("id", user.id)
    .maybeSingle();

  let url;
  try {
    const priceIds = await Promise.all(planKeysFor(choice).map((key) => ensurePrice(key, interval)));
    const customer = await ensureCustomer(user.id, user.email, stylist?.business_name);
    const site = await origin();
    // Still in the free trial: card now, first payment when the trial ends.
    const trialEnd =
      plan.inTrial && plan.trialEndsAt
        ? Math.floor(new Date(plan.trialEndsAt).getTime() / 1000)
        : null;
    // Stripe needs the trial to end at least 2 days from now.
    const useTrial = trialEnd && trialEnd > Date.now() / 1000 + 2 * 24 * 60 * 60;

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: priceIds.map((price) => ({ price, quantity: 1 })),
      subscription_data: {
        metadata: { stylist_id: user.id },
        ...(useTrial ? { trial_end: trialEnd } : {}),
      },
      metadata: { stylist_id: user.id, kind: "subscription" },
      allow_promotion_codes: true,
      success_url: `${site}/dashboard/settings?billing=success`,
      cancel_url: `${site}/dashboard/settings?billing=cancelled`,
    });
    url = session.url;
  } catch (error) {
    console.error("Couldn't start Clientele checkout", error);
    return { error: `Stripe couldn't open the payment page: ${error.message}` };
  }
  redirect(url);
}

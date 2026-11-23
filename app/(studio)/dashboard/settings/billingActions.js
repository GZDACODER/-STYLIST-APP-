"use server";

// Paying for Clientele: opens Stripe's payment page for All-in (monthly or
// yearly, plus any team members), and changes the team member count later.
// The plan switches on when Stripe tells the webhook it's paid.
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getMyPlan } from "@/lib/plan";
import { MAX_TEAM_MEMBERS, ensureCustomer, ensurePrice, setAssistant, setTeamMembers } from "@/lib/billing";
import { revalidatePath } from "next/cache";
import { paymentsConfigured, getStripe } from "@/lib/stripe";
import { publicSiteUrl } from "@/lib/siteUrl";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";

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
  const team = Number(formData.get("team_members") || 0);
  const withAssistant = formData.get("assistant") === "on";
  if (!Number.isInteger(team) || team < 0 || team > MAX_TEAM_MEMBERS) {
    return { error: `Please pick 0 to ${MAX_TEAM_MEMBERS} team members.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };

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
    // All-in, plus team members as a quantity on a second item (if any).
    const lineItems = [{ price: await ensurePrice("allin", interval), quantity: 1 }];
    if (team > 0) lineItems.push({ price: await ensurePrice("team", interval), quantity: team });
    if (withAssistant) lineItems.push({ price: await ensurePrice("assistant", interval), quantity: 1 });
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
      line_items: lineItems,
      subscription_data: {
        metadata: { stylist_id: user.id },
        ...(useTrial ? { trial_end: trialEnd } : {}),
      },
      metadata: { stylist_id: user.id, kind: "subscription" },
      allow_promotion_codes: true,
      success_url: `${site}/dashboard/settings/plan?billing=success`,
      cancel_url: `${site}/dashboard/settings/plan?billing=cancelled`,
    });
    url = session.url;
  } catch (error) {
    console.error("Couldn't start Clientele checkout", error);
    return { error: `Stripe couldn't open the payment page: ${error.message}` };
  }
  redirect(url);
}

// Settings: change how many team members the plan pays for (prorated).
export async function changeTeamMembers(prevState, formData) {
  if (!paymentsConfigured()) return { error: "Stripe isn't set up for this app yet." };
  const count = Number(formData.get("team_members"));
  if (!Number.isInteger(count) || count < 0 || count > MAX_TEAM_MEMBERS) {
    return { error: `Please pick 0 to ${MAX_TEAM_MEMBERS} team members.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const plan = await getMyPlan(supabase, user.id);
  if (plan.comped) return { error: "Your account is free, so there's nothing to change." };
  if (!plan.subscribed) return { error: "Choose a plan first, then add team members." };

  try {
    const saved = await setTeamMembers(user.id, count);
    revalidatePath("/dashboard/settings", "layout");
    return {
      success:
        saved === 0
          ? "Saved. No team members on your plan."
          : `Saved. ${saved} team ${saved === 1 ? "member" : "members"} on your plan, charged for the rest of this period.`,
    };
  } catch (error) {
    if (error?.message === "no_subscription") return { error: "Your plan isn't active right now. Check Manage billing." };
    console.error("Changing team members failed", error);
    return { error: `Stripe couldn't change your plan: ${error.message}` };
  }
}

// The Assistant add-on for accounts without a subscription to add it to:
// founding (free) accounts, which pay for it like everyone else. Opens
// Stripe's payment page for just the Assistant.
export async function startAssistantCheckout(prevState, formData) {
  if (!paymentsConfigured()) return { error: "Stripe isn't set up for this app yet." };
  const interval = formData.get("interval") === "year" ? "year" : "month";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const plan = await getMyPlan(supabase, user.id);
  if (!plan.ready) return { error: "Run supabase/migrations/0017_plans.sql in Supabase first." };
  if (plan.subscribed) return { error: "You already have a subscription. Use the Assistant switch above instead." };
  if (!plan.comped) return { error: "Choose your plan below, and tick Add the Assistant." };

  const { data: stylist } = await supabase.from("stylists").select("business_name").eq("id", user.id).maybeSingle();
  let url;
  try {
    const customer = await ensureCustomer(user.id, user.email, stylist?.business_name);
    const site = await origin();
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [{ price: await ensurePrice("assistant", interval), quantity: 1 }],
      subscription_data: { metadata: { stylist_id: user.id } },
      metadata: { stylist_id: user.id, kind: "subscription" },
      allow_promotion_codes: true,
      success_url: `${site}/dashboard/settings/plan?billing=success`,
      cancel_url: `${site}/dashboard/settings/plan?billing=cancelled`,
    });
    url = session.url;
  } catch (error) {
    console.error("Couldn't start Assistant checkout", error);
    return { error: `Stripe couldn't open the payment page: ${error.message}` };
  }
  redirect(url);
}

// Settings: add or remove the Assistant on an existing subscription (prorated).
export async function changeAssistant(prevState, formData) {
  if (!paymentsConfigured()) return { error: "Stripe isn't set up for this app yet." };
  const wanted = formData.get("assistant") === "on";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const plan = await getMyPlan(supabase, user.id);
  if (!plan.subscribed) return { error: "Choose a plan first, then add the Assistant." };

  try {
    const result = await setAssistant(user.id, wanted);
    revalidatePath("/dashboard", "layout");
    if (wanted) return { success: "The Assistant is on. Look for the chat button in the bottom corner." };
    const ends = result.endsAt
      ? new Date(result.endsAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null;
    return {
      success: ends
        ? `The Assistant will stop on ${ends}, at the end of what you've paid for.`
        : "The Assistant is off. The rest of this period is credited to your next bill.",
    };
  } catch (error) {
    if (error?.message === "no_subscription") return { error: "Your plan isn't active right now. Check Manage billing." };
    console.error("Changing the Assistant failed", error);
    return { error: `Stripe couldn't change your plan: ${error.message}` };
  }
}

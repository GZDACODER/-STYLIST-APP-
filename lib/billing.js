// Stylists paying Clientele (subscriptions). Server code only.
//
// Uses Clientele's own Stripe account (the same STRIPE_SECRET_KEY as
// deposits). Prices come from lib/plans.js: each plan and interval has a
// Stripe Price found by its lookup key. If a Price is missing, or its amount
// no longer matches lib/plans.js, a new one is made and takes over the
// lookup key, so changing a price only means editing lib/plans.js.
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLANS } from "@/lib/plans";
import { emailConfigured, sendEmails } from "@/lib/notify";
import { stylistEmails } from "@/lib/waitlist";
import { paymentFailedEmail } from "@/lib/planReminders";

// Subscriptions in these states keep their add-ons on. past_due = Stripe is
// still retrying a failed payment (about a week), so the stylist isn't cut
// off for one declined card.
const ACTIVE_STATUSES = ["active", "trialing", "past_due"];

const productId = (planKey) => `clientele_${planKey}`;

async function ensureProduct(plan) {
  const stripe = getStripe();
  try {
    const product = await stripe.products.retrieve(productId(plan.key));
    if (product.name !== plan.name || !product.active) {
      await stripe.products.update(product.id, { name: plan.name, active: true });
    }
    return product.id;
  } catch (error) {
    if (error?.code !== "resource_missing") throw error;
    const product = await stripe.products.create({
      id: productId(plan.key),
      name: plan.name,
      description: plan.description,
      metadata: { plan: plan.key },
    });
    return product.id;
  }
}

// The Stripe Price id for a plan ("base", "regulars", "waitlist", "bundle")
// and interval ("month" or "year").
export async function ensurePrice(planKey, interval) {
  const plan = PLANS[planKey];
  if (!plan || !["month", "year"].includes(interval)) throw new Error("Unknown plan.");
  const lookupKey = plan.lookupKeys[interval];
  const amount = interval === "year" ? plan.yearlyCents : plan.monthlyCents;

  const stripe = getStripe();
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const existing = data[0];
  if (existing && existing.unit_amount === amount && existing.recurring?.interval === interval) {
    return existing.id;
  }

  const price = await stripe.prices.create({
    product: await ensureProduct(plan),
    currency: "usd",
    unit_amount: amount,
    recurring: { interval },
    lookup_key: lookupKey,
    // Moves the lookup key from the old Price, if there was one.
    transfer_lookup_key: true,
    metadata: { plan: planKey },
  });
  if (existing) await stripe.prices.update(existing.id, { active: false });
  return price.id;
}

// What the stylist picked: the base plan or All-in, plus add-ons (only with
// the base plan). Returns the plan keys to put on the subscription.
export function planKeysFor({ bundle, regulars, waitlist }) {
  if (bundle) return ["bundle"];
  return ["base", ...(regulars ? ["regulars"] : []), ...(waitlist ? ["waitlist"] : [])];
}

// The stylist's Stripe customer (made the first time they pay).
export async function ensureCustomer(stylistId, email, businessName) {
  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("stylist_plans")
    .select("stripe_customer_id")
    .eq("stylist_id", stylistId)
    .maybeSingle();
  if (plan?.stripe_customer_id) return plan.stripe_customer_id;

  const customer = await getStripe().customers.create({
    email: email || undefined,
    name: businessName || undefined,
    metadata: { stylist_id: stylistId },
  });
  const { error } = await admin
    .from("stylist_plans")
    .update({ stripe_customer_id: customer.id, updated_at: new Date().toISOString() })
    .eq("stylist_id", stylistId);
  if (error) throw new Error(`Saving the Stripe customer failed: ${error.message}`);
  return customer.id;
}

async function emailPaymentFailed(admin, stylistId) {
  try {
    if (!emailConfigured()) return;
    const [emails, { data: stylist }] = await Promise.all([
      stylistEmails(admin, [stylistId]),
      admin.from("stylists").select("business_name, first_name").eq("id", stylistId).maybeSingle(),
    ]);
    if (!emails[stylistId]) return;
    const [result] = await sendEmails([
      paymentFailedEmail({
        to: emails[stylistId],
        businessName: stylist?.business_name || "your business",
        firstName: stylist?.first_name,
      }),
    ]);
    if (!result?.ok) console.error("Payment-failed email didn't send", result?.error);
  } catch (error) {
    console.error("Payment-failed email failed", error);
  }
}

// Stripe says a subscription changed: save which parts are paid for, then
// switch off anything that lapsed. Safe to run more than once.
export async function syncSubscription(subscription) {
  const admin = createAdminClient();
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;

  // Find the stylist: from the subscription's note, or by the customer.
  let stylistId = subscription.metadata?.stylist_id || null;
  if (!stylistId && customerId) {
    const { data } = await admin
      .from("stylist_plans")
      .select("stylist_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    stylistId = data?.stylist_id || null;
  }
  if (!stylistId) {
    console.error("Subscription has no stylist", subscription.id);
    return "not_found";
  }

  const on = ACTIVE_STATUSES.includes(subscription.status);

  // A late message about an old, ended subscription mustn't switch off a
  // newer one.
  const { data: current } = await admin
    .from("stylist_plans")
    .select("stripe_subscription_id, stripe_status")
    .eq("stylist_id", stylistId)
    .maybeSingle();
  if (
    !on &&
    current?.stripe_subscription_id &&
    current.stripe_subscription_id !== subscription.id &&
    ACTIVE_STATUSES.includes(current.stripe_status)
  ) {
    return "ignored";
  }
  const items = subscription.items?.data || [];
  const keys = new Set(
    items.map((item) => item.price?.lookup_key || "").filter((key) => key.startsWith("clientele_"))
  );
  const has = (planKey) => keys.has(PLANS[planKey].lookupKeys.month) || keys.has(PLANS[planKey].lookupKeys.year);
  const bundle = has("bundle");
  const periodEnd = Math.max(0, ...items.map((item) => item.current_period_end || 0));

  const { error } = await admin
    .from("stylist_plans")
    .update({
      base_active: on && (bundle || has("base")),
      regulars_active: on && (bundle || has("regulars")),
      waitlist_active: on && (bundle || has("waitlist")),
      billing_interval: items[0]?.price?.recurring?.interval || null,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_status: subscription.status,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("stylist_id", stylistId);
  if (error) throw new Error(`Saving the subscription failed: ${error.message}`);

  // Add-ons that just lapsed: Regulars-only mode and the waitlist go off.
  await admin.rpc("plan_apply_limits", { p_stylist_id: stylistId });

  // A payment just failed (Stripe will retry): tell the stylist once.
  if (subscription.status === "past_due" && current?.stripe_status !== "past_due") {
    await emailPaymentFailed(admin, stylistId);
  }
  return on ? "active" : "inactive";
}

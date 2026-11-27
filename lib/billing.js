// Stylists paying Clientele (subscriptions). Server code only.
//
// Uses Clientele's own Stripe account (the same STRIPE_SECRET_KEY as
// deposits). One plan, All-in, plus team members as a quantity on a second
// subscription item (lib/plans.js). Each has a Stripe Price per interval,
// found by its lookup key; if one is missing, or its amount no longer matches
// lib/plans.js, a new one is made and takes over the lookup key. Price ids set
// in Vercel (STRIPE_PRICE_ALLIN_MONTH and so on) are used instead when present.
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { LEGACY_LOOKUP_KEYS, PLANS } from "@/lib/plans";
import { emailConfigured, sendEmails } from "@/lib/notify";
import { stylistEmails } from "@/lib/waitlist";
import { paymentFailedEmail } from "@/lib/planReminders";

// Subscriptions in these states keep the plan on. past_due = Stripe is
// still retrying a failed payment (about a week), so the stylist isn't cut
// off for one declined card.
const ACTIVE_STATUSES = ["active", "trialing", "past_due"];

// Team members on one account: 0 to this many.
export const MAX_TEAM_MEMBERS = 50;

const productId = (planKey) => `clientele_${planKey}`;
const envPrice = (planKey, interval) =>
  process.env[`STRIPE_PRICE_${planKey.toUpperCase()}_${interval === "year" ? "YEAR" : "MONTH"}`] || null;

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

// The old plans' Prices ($15 base, add-ons, $29 All-in): archived so nobody
// new can pick them (in Stripe's billing page too). Subscriptions already on
// them carry on unchanged. Once per server start; never stops a payment.
let legacyArchived = false;
async function archiveLegacyPrices() {
  if (legacyArchived) return;
  legacyArchived = true;
  try {
    const stripe = getStripe();
    const { data } = await stripe.prices.list({ lookup_keys: LEGACY_LOOKUP_KEYS, active: true, limit: 20 });
    await Promise.all(data.map((price) => stripe.prices.update(price.id, { active: false })));
    if (data.length) console.log(`Archived ${data.length} old Clientele price(s)`);
  } catch (error) {
    legacyArchived = false;
    console.error("Couldn't archive the old Clientele prices", error?.message);
  }
}

// The Stripe Price id for "allin" or "team" and an interval ("month" or "year").
export async function ensurePrice(planKey, interval) {
  const plan = PLANS[planKey];
  if (!plan || !["month", "year"].includes(interval)) throw new Error("Unknown plan.");
  const fromEnv = envPrice(planKey, interval);
  if (fromEnv) {
    await archiveLegacyPrices();
    return fromEnv;
  }
  const lookupKey = plan.lookupKeys[interval];
  const amount = interval === "year" ? plan.yearlyCents : plan.monthlyCents;

  const stripe = getStripe();
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const existing = data[0];
  if (existing && existing.unit_amount === amount && existing.recurring?.interval === interval) {
    await archiveLegacyPrices();
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
  await archiveLegacyPrices();
  return price.id;
}

// Is this subscription item the team-member seat price?
function isTeamItem(item) {
  const key = item.price?.lookup_key || "";
  const id = item.price?.id;
  return (
    Object.values(PLANS.team.lookupKeys).includes(key) ||
    (id && (id === envPrice("team", "month") || id === envPrice("team", "year")))
  );
}

// Is this subscription item the shop's extra-chair price?
function isChairItem(item) {
  const key = item.price?.lookup_key || "";
  const id = item.price?.id;
  return (
    Object.values(PLANS.chair.lookupKeys).includes(key) ||
    (id && (id === envPrice("chair", "month") || id === envPrice("chair", "year")))
  );
}

// Is this subscription item the Assistant add-on?
function isAssistantItem(item) {
  const key = item.price?.lookup_key || "";
  const id = item.price?.id;
  return (
    Object.values(PLANS.assistant.lookupKeys).includes(key) ||
    (id && (id === envPrice("assistant", "month") || id === envPrice("assistant", "year")))
  );
}

// Is this a Clientele plan item (new or old prices)?
function isClienteleItem(item) {
  const key = item.price?.lookup_key || "";
  const id = item.price?.id;
  const envIds = ["allin", "team", "chair", "assistant"].flatMap((k) => [envPrice(k, "month"), envPrice(k, "year")]).filter(Boolean);
  return key.startsWith("clientele_") || (id && envIds.includes(id));
}

// The plan itself (All-in or an old plan), not a team seat or an add-on.
const isPlanItem = (item) => isClienteleItem(item) && !isTeamItem(item) && !isChairItem(item) && !isAssistantItem(item);

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
  // Any Clientele plan (All-in, or an old plan someone still pays for)
  // turns everything on. The Assistant add-on alone doesn't.
  const paying = on && items.some(isPlanItem);
  const teamItem = items.find(isTeamItem);
  const chairItem = items.find(isChairItem);
  const assistantItem = items.find(isAssistantItem);
  const mainItem = items.find(isPlanItem) || items[0];
  const periodEnd = Math.max(0, ...items.map((item) => item.current_period_end || 0));

  const row = {
    base_active: paying,
    regulars_active: paying,
    waitlist_active: paying,
    billing_interval: mainItem?.price?.recurring?.interval || null,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    stripe_status: subscription.status,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  // Team members (step 27 SQL) and the Assistant (step 33); saved without
  // them before that SQL is run.
  const extras = {
    team_members: on && teamItem ? teamItem.quantity || 0 : 0,
    assistant_active: Boolean(on && assistantItem),
    shop_chairs: on && chairItem ? chairItem.quantity || 0 : 0,
  };
  // Cancelled in Stripe's billing page: it stops at the end of the period
  // (or trial) instead of renewing. Stripe marks this with
  // cancel_at_period_end, or (newer accounts) a cancel_at date. Step 36 SQL.
  const cancelling = on && Boolean(subscription.cancel_at_period_end || subscription.cancel_at);
  const endsAt = subscription.cancel_at || (subscription.status === "trialing" && subscription.trial_end) || periodEnd;
  const cancel = {
    cancel_at_period_end: cancelling,
    cancel_at: cancelling && endsAt ? new Date(endsAt * 1000).toISOString() : null,
  };
  let { error } = await admin
    .from("stylist_plans")
    .update({ ...row, ...extras, ...cancel })
    .eq("stylist_id", stylistId);
  if (error && /shop_chairs/.test(error.message)) {
    delete extras.shop_chairs;
    ({ error } = await admin
      .from("stylist_plans")
      .update({ ...row, ...extras, ...cancel })
      .eq("stylist_id", stylistId));
  }
  if (error && /cancel_at/.test(error.message)) {
    ({ error } = await admin
      .from("stylist_plans")
      .update({ ...row, ...extras })
      .eq("stylist_id", stylistId));
  }
  if (error && /assistant_active/.test(error.message)) {
    ({ error } = await admin
      .from("stylist_plans")
      .update({ ...row, team_members: extras.team_members })
      .eq("stylist_id", stylistId));
  }
  if (error && /team_members/.test(error.message)) {
    ({ error } = await admin.from("stylist_plans").update(row).eq("stylist_id", stylistId));
  }
  if (error) throw new Error(`Saving the subscription failed: ${error.message}`);

  // Add-ons that just lapsed: Regulars-only mode and the waitlist go off.
  await admin.rpc("plan_apply_limits", { p_stylist_id: stylistId });

  // A payment just failed (Stripe will retry): tell the stylist once.
  if (subscription.status === "past_due" && current?.stripe_status !== "past_due") {
    await emailPaymentFailed(admin, stylistId);
  }
  return on ? "active" : "inactive";
}

// Sets how many extra chairs a shop owner pays for (lib/shops.js), on
// their subscription, the same way as team members below. No subscription
// yet (trial, or a free account): nothing to change, and Choose a plan
// adds the chairs. Returns the saved count, or null with no subscription.
export async function setShopChairs(stylistId, count) {
  const wanted = Math.round(Number(count));
  if (!Number.isInteger(wanted) || wanted < 0 || wanted > 50) throw new Error("invalid_count");
  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("stylist_plans")
    .select("stripe_subscription_id, comped")
    .eq("stylist_id", stylistId)
    .maybeSingle();
  if (!plan?.stripe_subscription_id || plan.comped) return null;
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(plan.stripe_subscription_id);
  if (!ACTIVE_STATUSES.includes(subscription.status)) return null;
  const items = subscription.items?.data || [];
  // Only on a subscription for the plan itself (not an Assistant-only one).
  const mainItem = items.find(isPlanItem);
  if (!mainItem) return null;
  const interval = mainItem.price?.recurring?.interval === "year" ? "year" : "month";
  const chairItem = items.find(isChairItem);
  const proration = { proration_behavior: "create_prorations" };
  if (wanted === 0) {
    if (chairItem) await stripe.subscriptionItems.del(chairItem.id, proration);
  } else {
    const price = await ensurePrice("chair", interval);
    if (chairItem && chairItem.price?.id === price) {
      if (chairItem.quantity !== wanted) await stripe.subscriptionItems.update(chairItem.id, { quantity: wanted, ...proration });
    } else {
      if (chairItem) await stripe.subscriptionItems.del(chairItem.id, proration);
      await stripe.subscriptionItems.create({ subscription: subscription.id, price, quantity: wanted, ...proration });
    }
  }
  await syncSubscription(await stripe.subscriptions.retrieve(subscription.id));
  return wanted;
}

// Sets how many team members the stylist pays for, on their current
// subscription: adds, changes or removes the team-member item. Changes are
// prorated (charged or credited for the rest of the period). Used by
// Settings now, and by staff seats later. Returns the saved count.
export async function setTeamMembers(stylistId, count) {
  const wanted = Math.round(Number(count));
  if (!Number.isInteger(wanted) || wanted < 0 || wanted > MAX_TEAM_MEMBERS) throw new Error("invalid_count");

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("stylist_plans")
    .select("stripe_subscription_id")
    .eq("stylist_id", stylistId)
    .maybeSingle();
  if (!plan?.stripe_subscription_id) throw new Error("no_subscription");

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(plan.stripe_subscription_id);
  if (!ACTIVE_STATUSES.includes(subscription.status)) throw new Error("no_subscription");

  const items = subscription.items?.data || [];
  const mainItem = items.find(isPlanItem) || items[0];
  const interval = mainItem?.price?.recurring?.interval === "year" ? "year" : "month";
  const teamItem = items.find(isTeamItem);
  const proration = { proration_behavior: "create_prorations" };

  if (wanted === 0) {
    if (teamItem) await stripe.subscriptionItems.del(teamItem.id, proration);
  } else {
    const price = await ensurePrice("team", interval);
    if (teamItem && teamItem.price?.id === price) {
      if (teamItem.quantity !== wanted) await stripe.subscriptionItems.update(teamItem.id, { quantity: wanted, ...proration });
    } else {
      // None yet, or one on another interval's price: put the right one on.
      if (teamItem) await stripe.subscriptionItems.del(teamItem.id, proration);
      await stripe.subscriptionItems.create({ subscription: subscription.id, price, quantity: wanted, ...proration });
    }
  }

  await syncSubscription(await stripe.subscriptions.retrieve(subscription.id));
  return wanted;
}

// Adds or removes the Assistant add-on on the stylist's subscription,
// prorated. When the Assistant is the only thing on it (a founding account
// paying just for the Assistant), removing it cancels at the end of the
// period instead, and adding it again undoes that.
// Returns { on, endsAt } (endsAt: when a cancelled-at-period-end one stops).
export async function setAssistant(stylistId, wanted) {
  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("stylist_plans")
    .select("stripe_subscription_id")
    .eq("stylist_id", stylistId)
    .maybeSingle();
  if (!plan?.stripe_subscription_id) throw new Error("no_subscription");

  const stripe = getStripe();
  let subscription = await stripe.subscriptions.retrieve(plan.stripe_subscription_id);
  if (!ACTIVE_STATUSES.includes(subscription.status)) throw new Error("no_subscription");

  const items = subscription.items?.data || [];
  const assistantItem = items.find(isAssistantItem);
  const others = items.filter((item) => !isAssistantItem(item));
  const mainItem = items.find(isPlanItem) || others[0] || items[0];
  const interval = mainItem?.price?.recurring?.interval === "year" ? "year" : "month";
  const proration = { proration_behavior: "create_prorations" };
  let endsAt = null;

  if (wanted) {
    if (assistantItem) {
      if (subscription.cancel_at_period_end) {
        subscription = await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: false });
      }
    } else {
      const price = await ensurePrice("assistant", interval);
      await stripe.subscriptionItems.create({ subscription: subscription.id, price, quantity: 1, ...proration });
    }
  } else if (assistantItem) {
    if (others.length === 0) {
      subscription = await stripe.subscriptions.update(subscription.id, { cancel_at_period_end: true });
      const end = Math.max(0, ...items.map((item) => item.current_period_end || 0));
      endsAt = end ? new Date(end * 1000).toISOString() : null;
    } else {
      await stripe.subscriptionItems.del(assistantItem.id, proration);
    }
  }

  await syncSubscription(await stripe.subscriptions.retrieve(subscription.id));
  return { on: Boolean(wanted), endsAt };
}

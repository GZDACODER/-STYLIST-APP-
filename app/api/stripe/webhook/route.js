// Stripe calls this address when a deposit is paid or a payment page times
// out (see DEPOSITS_SETUP.md), and when a stylist's Clientele subscription
// starts, changes or ends (see BILLING_SETUP.md), and when a client disputes
// a deposit (charge.dispute.*: lib/disputes.js).
import { finalizeCheckoutSession, getStripe, releaseCheckoutSession } from "@/lib/stripe";
import { syncSubscription } from "@/lib/billing";
import { handleDispute } from "@/lib/disputes";
import { reportError } from "@/lib/errorAlerts";

const SUBSCRIPTION_EVENTS = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
];

export async function POST(request) {
  // The exact raw body Stripe signed: read as text, never parsed first.
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  // Trimmed, so a stray space or line break from pasting it into Vercel
  // can't break every check.
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();

  // Check the message really came from Stripe.
  let event;
  try {
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set for this deployment.");
    if (!signature) throw new Error("The request has no stripe-signature header.");
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch (error) {
    // Shows in Vercel's logs. Says what looks wrong without printing the secret.
    console.error("Stripe webhook signature check failed:", error.message, {
      secretSet: Boolean(secret),
      secretLooksRight: secret.startsWith("whsec_"),
      secretLength: secret.length,
      hasSignatureHeader: Boolean(signature),
      bodyLength: body.length,
      testKey: String(process.env.STRIPE_SECRET_KEY || "").trim().startsWith("sk_test_"),
    });
    // Only alert when it looks like Stripe (it sent a signature): then the
    // secret in Vercel is probably wrong and payments aren't being recorded.
    if (signature) await reportError("Stripe webhook signature", error);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const object = event.data.object;
    if (event.type.startsWith("charge.dispute.")) {
      await handleDispute(object, event.type);
    } else if (SUBSCRIPTION_EVENTS.includes(event.type)) {
      await syncSubscription(object);
    } else if (event.type.startsWith("checkout.session.") && object.mode === "subscription") {
      // A stylist finished Clientele's payment page: switch their plan on now,
      // without waiting for the subscription message.
      if (event.type === "checkout.session.completed" && object.subscription) {
        const id = typeof object.subscription === "string" ? object.subscription : object.subscription.id;
        await syncSubscription(await getStripe().subscriptions.retrieve(id));
      }
    } else if (
      event.type === "checkout.session.completed" ||
      // A slow payment method (e.g. a bank payment) finally cleared.
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const outcome = await finalizeCheckoutSession(event.data.object);
      if (outcome === "not_found") {
        await reportError("Stripe webhook", new Error("A paid deposit has no matching booking"), { extra: `Checkout session ${event.data.object.id}` });
      }
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      await releaseCheckoutSession(event.data.object);
    }
  } catch (error) {
    // A 500 makes Stripe try again later.
    await reportError("Stripe webhook", error, { extra: `Event ${event.type} ${event.id}` });
    return new Response("Webhook failed", { status: 500 });
  }

  return Response.json({ received: true });
}

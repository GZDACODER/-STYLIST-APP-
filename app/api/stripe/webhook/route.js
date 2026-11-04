// Stripe calls this address when a deposit is paid or a payment page times
// out (see DEPOSITS_SETUP.md), and when a stylist's Clientele subscription
// starts, changes or ends (see BILLING_SETUP.md).
import { finalizeCheckoutSession, getStripe, releaseCheckoutSession } from "@/lib/stripe";
import { syncSubscription } from "@/lib/billing";

const SUBSCRIPTION_EVENTS = [
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
];

export async function POST(request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  // Check the message really came from Stripe.
  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    console.error("Stripe webhook signature check failed", error.message);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const object = event.data.object;
    if (SUBSCRIPTION_EVENTS.includes(event.type)) {
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
      if (outcome === "not_found") console.error("Paid deposit has no booking", event.data.object.id);
    } else if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      await releaseCheckoutSession(event.data.object);
    }
  } catch (error) {
    // A 500 makes Stripe try again later.
    console.error("Stripe webhook failed", error);
    return new Response("Webhook failed", { status: 500 });
  }

  return Response.json({ received: true });
}

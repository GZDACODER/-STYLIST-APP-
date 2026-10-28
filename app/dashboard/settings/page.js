import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, paymentsConfigured } from "@/lib/stripe";
import SettingsForm from "./SettingsForm";
import DepositsForm from "./DepositsForm";

export const metadata = { title: "Settings · GZ Stylist App" };

const STRIPE_NOTICES = {
  not_configured: {
    kind: "error",
    text: "Stripe isn't set up for this app yet. Add the Stripe keys in Netlify first (see DEPOSITS_SETUP.md).",
  },
  error: { kind: "error", text: "Stripe had a problem. Please try again in a minute." },
};

// Asks Stripe whether the stylist's account can take payments yet, and saves
// the answer. (Only Stripe can say so, which is why stylists can't edit it.)
async function refreshStripeStatus(userId, accountId, savedEnabled) {
  try {
    const account = await getStripe().accounts.retrieve(accountId);
    const enabled = Boolean(account.charges_enabled);
    if (enabled !== savedEnabled) {
      await createAdminClient()
        .from("stylists")
        .update({ stripe_charges_enabled: enabled })
        .eq("id", userId);
    }
    return { enabled, detailsSubmitted: Boolean(account.details_submitted) };
  } catch (error) {
    console.error("Couldn't check Stripe account", error);
    return { enabled: savedEnabled, detailsSubmitted: savedEnabled };
  }
}

export default async function SettingsPage({ searchParams }) {
  const { stripe: stripeParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: stylist }, { data: services }] = await Promise.all([
    supabase
      .from("stylists")
      .select(
        "business_name, slug, timezone, deposits_enabled, cancellation_policy, stripe_account_id, stripe_charges_enabled"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("services")
      .select("id, name, price_cents, deposit_type, deposit_amount")
      .order("created_at", { ascending: true }),
  ]);
  if (!stylist) redirect("/dashboard");

  const configured = paymentsConfigured();
  let stripe = { connected: false, enabled: false, detailsSubmitted: false };
  if (stylist.stripe_account_id) {
    stripe = { connected: true, enabled: stylist.stripe_charges_enabled, detailsSubmitted: false };
    if (configured) {
      stripe = {
        connected: true,
        ...(await refreshStripeStatus(user.id, stylist.stripe_account_id, stylist.stripe_charges_enabled)),
      };
    }
  }

  const notice = STRIPE_NOTICES[stripeParam];

  return (
    <>
      <section className="card">
        <h2>Settings</h2>
        <SettingsForm
          businessName={stylist.business_name}
          slug={stylist.slug}
          timezone={stylist.timezone}
        />
      </section>

      <section className="card">
        <h2>Get paid with Stripe</h2>
        {notice && <p className={`message ${notice.kind}`}>{notice.text}</p>}
        {!configured && !notice && (
          <p className="message warning">
            Stripe isn&apos;t set up for this app yet. Add the keys in Netlify (see
            DEPOSITS_SETUP.md), then come back here.
          </p>
        )}
        <div className="stripe-status">
          {stripe.enabled ? (
            <span className="badge paid">Connected</span>
          ) : stripe.connected ? (
            <span className="badge unpaid">Not finished</span>
          ) : (
            <span className="badge">Not connected</span>
          )}
          {stripe.enabled ? (
            <a href="/dashboard/stripe/dashboard" className="button secondary small">
              Open Stripe
            </a>
          ) : (
            configured && (
              <a href="/dashboard/stripe/connect" className="button small">
                {stripe.connected ? "Finish Stripe setup" : "Connect Stripe"}
              </a>
            )
          )}
        </div>
        <p className="muted small-text">
          {stripe.enabled
            ? "Deposits go straight into your own Stripe account, and Stripe pays them out to your bank."
            : stripe.connected && stripe.detailsSubmitted
              ? "Stripe is checking your details. This usually takes a few minutes. Refresh this page to check."
              : "Connect your own Stripe account so clients' deposits are paid to you. Stripe asks for your details and the bank account to pay you into."}
        </p>
      </section>

      <section className="card">
        <h2>Deposits</h2>
        <DepositsForm
          enabled={stylist.deposits_enabled}
          policy={stylist.cancellation_policy}
          stripeReady={stripe.enabled}
          services={services || []}
        />
      </section>
    </>
  );
}

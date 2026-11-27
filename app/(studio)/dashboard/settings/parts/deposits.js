// Settings section: Deposits (server component).
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, paymentsConfigured } from "@/lib/stripe";
import DepositsForm from "../DepositsForm";
import PayLaterForm from "../PayLaterForm";
import { payLaterAvailable } from "@/lib/payLaterServer";
import { me, optional } from "./common";

const STRIPE_NOTICES = {
  not_configured: {
    kind: "error",
    text: "Stripe isn't set up for this app yet. Add the Stripe keys in Vercel first (see DEPOSITS_SETUP.md).",
  },
  error: { kind: "error", text: "Stripe had a problem. Please try again in a minute." },
};

// Asks Stripe whether the stylist's account can receive deposits yet, and
// saves the answer. (Only Stripe can say so, which is why stylists can't edit it.)
async function refreshStripeStatus(userId, accountId, savedEnabled) {
  try {
    const account = await getStripe().v2.core.accounts.retrieve(accountId, {
      include: ["configuration.recipient", "requirements"],
    });
    const transfers = account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers;
    const enabled = transfers?.status === "active";
    // Finished = Stripe isn't waiting on anything more from the stylist.
    const detailsSubmitted = !(account.requirements?.entries || []).some(
      (entry) => entry.awaiting_action_from === "user"
    );
    if (enabled !== savedEnabled) {
      await createAdminClient().from("stylists").update({ stripe_charges_enabled: enabled }).eq("id", userId);
    }
    return { enabled, detailsSubmitted };
  } catch (error) {
    console.error("Couldn't check Stripe account", error);
    return { enabled: savedEnabled, detailsSubmitted: savedEnabled };
  }
}

export async function DepositsSection({ stripeParam, reason }) {
  const { supabase, user, row } = await me(
    "deposits_enabled, cancellation_policy, stripe_account_id, stripe_charges_enabled"
  );
  if (!user) return null;
  const { data: services } = await supabase
    .from("services")
    .select("id, name, price_cents, deposit_type, deposit_amount")
    .order("created_at", { ascending: true });
  const configured = paymentsConfigured();
  let stripe = { connected: false, enabled: false, detailsSubmitted: false };
  if (row.stripe_account_id) {
    stripe = { connected: true, enabled: row.stripe_charges_enabled, detailsSubmitted: false };
    if (configured) {
      stripe = { connected: true, ...(await refreshStripeStatus(user.id, row.stripe_account_id, row.stripe_charges_enabled)) };
    }
  }
  const notice = STRIPE_NOTICES[stripeParam];
  // Before the 0082 SQL there's no column: shown as off.
  const payLater = await supabase.from("stylists").select("pay_later_on").eq("id", user.id).maybeSingle();
  return (
    <>
      <section className="card">
        <h2>Get paid with Stripe</h2>
        {notice && (
          <p className={`message ${notice.kind}`}>
            {notice.text}
            {reason && (
              <>
                <br />
                <span className="small-text">Details: {String(reason)}</span>
              </>
            )}
          </p>
        )}
        {!configured && !notice && (
          <p className="message warning">
            Stripe isn&apos;t set up for this app yet. Add the keys in Vercel (see DEPOSITS_SETUP.md), then come back
            here.
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
          enabled={row.deposits_enabled}
          policy={row.cancellation_policy}
          stripeReady={stripe.enabled}
          services={services || []}
        />
      </section>

      <section className="card" id="pay-later">
        <h2>Pay over time</h2>
        <PayLaterForm on={Boolean(payLater.data?.pay_later_on)} live={(await payLaterAvailable()).length > 0} stripeReady={stripe.enabled} />
      </section>
    </>
  );
}

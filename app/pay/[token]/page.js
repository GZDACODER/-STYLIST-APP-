// A payment link (Money → Payment links, 0080 SQL): one card with who's
// asking, how much and what for. Apple Pay / Google Pay right here
// (WalletButtons), or "Pay with card" on Stripe's page, which sends them back
// with ?session_id=… once paid.
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { createPaymentLinkCheckout, finalizePaymentLinkIntent, finalizePaymentLinkSession, loadPaymentLink } from "@/lib/paymentLinksServer";
import { formatLinkAmount } from "@/lib/paymentLinks";
import SubmitButton from "@/components/SubmitButton";
import WalletButtons from "@/components/pay/WalletButtons";
import { payLaterFor } from "@/lib/payLaterServer";
import { payLaterNames } from "@/lib/payLater";
import { finishWalletPayment, startWalletPayment } from "./walletActions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { token } = await params;
  const link = await loadPaymentLink(token);
  const name = link?.stylist?.business_name;
  return {
    title: name ? `Pay ${name}` : "Payment",
    description: link ? `${formatLinkAmount(link.amount_cents)} for ${link.description}` : undefined,
    robots: { index: false, follow: false },
  };
}

async function pay(formData) {
  "use server";
  const token = String(formData.get("token") || "");
  const payLater = formData.get("later") === "1";
  const h = await headers();
  const origin = h.get("origin") || `https://${h.get("host")}`;
  let url;
  try {
    url = await createPaymentLinkCheckout(token, origin, { payLater });
  } catch (error) {
    redirect(`/pay/${encodeURIComponent(token)}?problem=${encodeURIComponent(error.message || "failed")}`);
  }
  redirect(url);
}

const PROBLEM = {
  no_payouts: "This business can't take online payments yet. Please pay them another way.",
  cancelled: "This payment link was cancelled.",
  paid: "This has already been paid.",
  failed: "The payment page couldn't open. Please try again in a moment.",
  no_pay_later: "Pay over time isn't available for this payment. Please pay with card.",
};

const Lock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export default async function PayPage({ params, searchParams }) {
  const { token } = await params;
  const { session_id: sessionId, payment_intent: intentId, problem } = await searchParams;
  let link = await loadPaymentLink(token);
  if (!link) notFound();

  // Back from Stripe: record it now if the webhook hasn't yet (safe twice).
  if (link.status !== "paid" && (String(sessionId || "").startsWith("cs_") || String(intentId || "").startsWith("pi_"))) {
    try {
      if (sessionId) {
        const session = await getStripe().checkout.sessions.retrieve(sessionId);
        if (session.metadata?.payment_link_id === link.id) await finalizePaymentLinkSession(session);
      } else {
        const intent = await getStripe().paymentIntents.retrieve(intentId, { expand: ["latest_charge"] });
        if (intent.metadata?.payment_link_id === link.id) await finalizePaymentLinkIntent(intent);
      }
      link = (await loadPaymentLink(token)) || link;
    } catch {
      // The webhook will record it.
    }
  }

  const s = link.stylist || {};
  const name = s.business_name || "";
  const amount = formatLinkAmount(link.amount_cents);
  const canPay = Boolean(s.stripe_account_id && s.stripe_charges_enabled);
  const later = canPay && link.status === "open" ? await payLaterFor(s, link.amount_cents) : [];
  const photo = /^https:\/\//.test(s.cover_photo_url || "") ? s.cover_photo_url : null;

  return (
    <section className="py-card" aria-labelledby="py-amount">
      <header className="py-pro">
        {photo ? (
          <img className="py-avatar" src={photo} alt="" width="56" height="56" />
        ) : (
          <span className="py-avatar py-monogram" aria-hidden="true">
            {(name.trim()[0] || "C").toUpperCase()}
          </span>
        )}
        <p className="py-name">{s.slug ? <a href={`/book/${s.slug}`}>{name}</a> : name}</p>
        <p className="py-kicker">{link.status === "paid" ? "Payment received" : "Payment request"}</p>
      </header>

      <p className="py-amount" id="py-amount">
        {amount}
      </p>
      <p className="py-for">{link.description}</p>
      {link.client_name && <p className="py-client">For {link.client_name}</p>}

      {link.status === "paid" ? (
        <div className="py-done" role="status">
          <div className="py-check" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </div>
          <p>
            <strong>Paid. Thank you!</strong>
          </p>
          <p className="py-done-sub">Stripe emails your receipt, and {name} has been told.</p>
        </div>
      ) : link.status === "cancelled" ? (
        <p className="message info">This payment link was cancelled. If you think that&apos;s a mistake, contact {name}.</p>
      ) : !canPay ? (
        <p className="message info">{PROBLEM.no_payouts}</p>
      ) : (
        <>
          {(sessionId || intentId) && (
            <p className="message info">We haven&apos;t received this payment yet. If you paid, it can take a minute. Otherwise, try again below.</p>
          )}
          {PROBLEM[problem] && <p className="message error">{PROBLEM[problem]}</p>}
          <div className="py-actions">
            <WalletButtons
              amountCents={link.amount_cents}
              start={startWalletPayment.bind(null, link.token)}
              finish={finishWalletPayment.bind(null, link.token)}
              returnPath={`/pay/${link.token}`}
            />
            <form action={pay}>
              <input type="hidden" name="token" value={link.token} />
              <SubmitButton className="py-btn" pendingText="Opening secure payment...">
                Pay {amount} with card
              </SubmitButton>
            </form>
            {later.length > 0 && (
              <form action={pay}>
                <input type="hidden" name="token" value={link.token} />
                <input type="hidden" name="later" value="1" />
                <SubmitButton className="py-btn is-quiet" pendingText="Opening...">
                  Pay over time
                </SubmitButton>
                <p className="py-later">Split it into payments with {payLaterNames(later)}.</p>
              </form>
            )}
            <p className="py-secure">
              <Lock /> Secure payment by Stripe
            </p>
          </div>
        </>
      )}
    </section>
  );
}

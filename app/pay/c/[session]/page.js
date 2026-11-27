// A deposit or gift card payment (lib/walletCheckout.js): Apple Pay /
// Google Pay right here, or "Pay with card" on Stripe's page. Phones and
// browsers with no wallet go straight on to Stripe's page.
import { notFound, redirect } from "next/navigation";
import WalletButtons from "@/components/pay/WalletButtons";
import { formatLinkAmount } from "@/lib/paymentLinks";
import { finishCheckoutWallet, loadWalletCheckout, successUrl } from "@/lib/walletCheckout";
import { finishCheckoutPayment, startCheckoutPayment } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment", robots: { index: false, follow: false } };

const Lock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </svg>
);

export default async function CheckoutWalletPage({ params, searchParams }) {
  const { session: sessionId } = await params;
  const { payment_intent: intentId } = await searchParams;
  const c = await loadWalletCheckout(sessionId);
  if (!c) notFound();
  const { session, kind, stylist: s } = c;

  // Back from a wallet that needed a redirect: record it, then on.
  if (String(intentId || "").startsWith("pi_")) {
    try {
      await finishCheckoutWallet(session.id, intentId);
    } catch {
      // The webhook records it.
    }
    redirect(successUrl(session));
  }
  if (session.status === "complete") redirect(successUrl(session));
  if (session.status !== "open") redirect(session.cancel_url || `/book/${s.slug}`);

  const name = s.business_name || "";
  const amount = formatLinkAmount(c.amountCents);
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
        <p className="py-name">{name}</p>
        <p className="py-kicker">{kind === "gift" ? "Gift card" : "Deposit"}</p>
      </header>

      <p className="py-amount" id="py-amount">
        {amount}
      </p>
      <p className="py-for">{c.title}</p>

      <div className="py-actions">
        <WalletButtons
          amountCents={c.amountCents}
          start={startCheckoutPayment.bind(null, session.id)}
          finish={finishCheckoutPayment.bind(null, session.id)}
          returnPath={`/pay/c/${session.id}`}
          fallbackUrl={session.url}
        />
        <a className="py-btn py-btn-link" href={session.url}>
          Pay {amount} with card
        </a>
        <p className="py-secure">
          <Lock /> Secure payment by Stripe
        </p>
        {session.cancel_url && (
          <p className="py-back">
            <a href={session.cancel_url}>Go back</a>
          </p>
        )}
      </div>
    </section>
  );
}

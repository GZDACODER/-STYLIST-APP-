// A payment link (Money → Payment links, 0080 SQL): the client sees who's
// asking, how much and what for, and pays on Stripe's page. Stripe sends
// them back here with ?session_id=… once paid.
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import StylistShell from "@/app/book/[slug]/StylistShell";
import { getStripe } from "@/lib/stripe";
import { createPaymentLinkCheckout, finalizePaymentLinkSession, loadPaymentLink } from "@/lib/paymentLinksServer";
import { formatLinkAmount } from "@/lib/paymentLinks";
import SubmitButton from "@/components/SubmitButton";

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
  const h = await headers();
  const origin = h.get("origin") || `https://${h.get("host")}`;
  let url;
  try {
    url = await createPaymentLinkCheckout(token, origin);
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
};

export default async function PayPage({ params, searchParams }) {
  const { token } = await params;
  const { session_id: sessionId, problem } = await searchParams;
  let link = await loadPaymentLink(token);
  if (!link) notFound();

  // Back from Stripe: record it now if the webhook hasn't yet (safe twice).
  if (String(sessionId || "").startsWith("cs_") && link.status !== "paid") {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      if (session.metadata?.payment_link_id === link.id) await finalizePaymentLinkSession(session);
      link = (await loadPaymentLink(token)) || link;
    } catch {
      // The webhook will record it.
    }
  }

  const s = link.stylist || {};
  const amount = formatLinkAmount(link.amount_cents);
  const canPay = Boolean(s.stripe_account_id && s.stripe_charges_enabled);

  return (
    <StylistShell slug={s.slug}>
      <section className="pl-card">
        <p className="bk-kicker">Payment request from {s.business_name}</p>
        <p className="pl-amount">{amount}</p>
        <p className="pl-for">{link.description}</p>
        {link.client_name && <p className="muted small-text">For {link.client_name}</p>}

        {link.status === "paid" ? (
          <p className="message success pl-done">
            <strong>Paid. Thank you!</strong> Stripe emails your receipt, and {s.business_name} has been told.
          </p>
        ) : link.status === "cancelled" ? (
          <p className="message info">This payment link was cancelled. If you think that&apos;s a mistake, contact {s.business_name}.</p>
        ) : !canPay ? (
          <p className="message info">{PROBLEM.no_payouts}</p>
        ) : (
          <>
            {sessionId && <p className="message info">We haven&apos;t received this payment yet. If you paid, it can take a minute. Otherwise, try again below.</p>}
            {PROBLEM[problem] && <p className="message error">{PROBLEM[problem]}</p>}
            <form action={pay}>
              <input type="hidden" name="token" value={link.token} />
              <SubmitButton className="button pl-pay" pendingText="Opening secure payment...">
                Pay {amount}
              </SubmitButton>
            </form>
            <p className="muted small-text pl-secure">Secure payment by Stripe: card, Apple Pay, Google Pay, Cash App Pay or Link.</p>
          </>
        )}
      </section>
    </StylistShell>
  );
}

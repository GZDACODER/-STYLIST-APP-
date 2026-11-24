// Stripe sends the buyer here after paying for a gift card.
import Link from "next/link";
import StylistShell from "../../StylistShell";
import { getStripe } from "@/lib/stripe";
import { finalizeGiftSession } from "@/lib/giftCards";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPrice } from "@/lib/money";

export const metadata = { title: "Gift Card Sent" };

export default async function GiftThanks({ params, searchParams }) {
  const { slug } = await params;
  const { session_id: sessionId } = await searchParams;
  let card = null;
  if (String(sessionId || "").startsWith("cs_")) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      // The webhook usually does this first; doing it here too is safe.
      await finalizeGiftSession(session);
      const { data } = await createAdminClient()
        .from("gift_cards")
        .select("amount_cents, recipient_name, recipient_email, buyer_email, status")
        .eq("checkout_session_id", session.id)
        .maybeSingle();
      card = data;
    } catch {
      card = null;
    }
  }
  return (
    <StylistShell slug={slug}>
      <section className="card">
        {card?.status === "active" || card?.status === "used" ? (
          <>
            <h2>Gift card sent</h2>
            <p>
              Your {formatPrice(card.amount_cents)} gift card for {card.recipient_name} has been emailed to{" "}
              {card.recipient_email ? card.recipient_name : "you"}, with its code.
            </p>
          </>
        ) : (
          <>
            <h2>We couldn&apos;t confirm this payment</h2>
            <p className="muted">If you paid, check your email for a receipt from Stripe. The gift card email follows shortly.</p>
          </>
        )}
        <Link href={`/book/${slug}`} className="button secondary">
          Back to booking
        </Link>
      </section>
    </StylistShell>
  );
}

// Buy a gift card for this business (step 65 SQL). Only when the pro has
// turned gift cards on and Stripe is ready.
import Link from "next/link";
import { notFound } from "next/navigation";
import StylistShell from "../StylistShell";
import { createAdminClient } from "@/lib/supabase/admin";
import { GIFT_AMOUNTS } from "@/lib/giftCards";
import { displayName } from "@/lib/bookingHeader";
import GiftForm from "./GiftForm";

export const metadata = { title: "Gift Card" };

export default async function GiftPage({ params, searchParams }) {
  const { slug } = await params;
  const { cancelled } = await searchParams;
  const { data: s } = await createAdminClient()
    .from("stylists")
    .select("business_name, gift_cards_on, stripe_account_id, stripe_charges_enabled")
    .eq("slug", slug)
    .maybeSingle();
  if (!s) notFound();
  const ready = s.gift_cards_on && s.stripe_account_id && s.stripe_charges_enabled;
  const name = displayName(s.business_name);
  return (
    <StylistShell slug={slug}>
      <section className="card">
        <h2>Give a gift card</h2>
        {!ready ? (
          <>
            <p className="muted">{name} isn&apos;t selling gift cards online right now.</p>
            <Link href={`/book/${slug}`}>Back to booking</Link>
          </>
        ) : (
          <>
            {cancelled && <p className="message info">Payment cancelled. Nothing was charged.</p>}
            <p className="muted small-text">
              A gift card for {name}, emailed with a code they show when they pay. Paid securely with Stripe.
            </p>
            <GiftForm slug={slug} amounts={GIFT_AMOUNTS} />
          </>
        )}
      </section>
    </StylistShell>
  );
}

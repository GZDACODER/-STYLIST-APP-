// Clients land here from the "Claim this time" button in a waitlist message.
import Link from "next/link";
import { createBookingClient } from "@/lib/supabase/booking";
import ClaimOffer from "./ClaimOffer";

export const metadata = { title: "Claim this time" };

export default async function ClaimPage({ params, searchParams }) {
  const { slug } = await params;
  const { t: token, payment } = await searchParams;
  const bookingLink = `/book/${slug}`;

  let offer = null;
  if (typeof token === "string" && /^[0-9a-f]{64}$/.test(token)) {
    const supabase = await createBookingClient();
    const { data } = await supabase.rpc("get_waitlist_offer", { p_token: token });
    offer = data;
  }

  if (!offer) {
    return (
      <section className="card">
        <h2>This link doesn&apos;t work</h2>
        <p className="muted">It may be incomplete. Try tapping the button in your message again.</p>
        <Link href={bookingLink}>Go to the booking page</Link>
      </section>
    );
  }

  return (
    <>
      <h1>{offer.business_name}</h1>
      <ClaimOffer
        offer={offer}
        token={token}
        bookingLink={`/book/${offer.slug}`}
        paymentCancelled={payment === "cancelled"}
      />
    </>
  );
}

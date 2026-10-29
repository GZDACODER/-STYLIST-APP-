// Stripe sends the client here if they leave the payment page without paying.
// Closes the payment page and frees the time straight away.
import { NextResponse } from "next/server";
import { createBookingClient } from "@/lib/supabase/booking";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

export async function GET(request, { params }) {
  const { slug } = await params;
  const url = new URL(request.url);
  const bookingId = url.searchParams.get("booking") || "";
  // Set when the time was claimed from a waitlist message.
  const claimToken = url.searchParams.get("t") || "";
  const back = new URL(
    claimToken
      ? `/book/${slug}/claim?t=${encodeURIComponent(claimToken)}&payment=cancelled`
      : `/book/${slug}?payment=cancelled`,
    url.origin
  );

  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) return NextResponse.redirect(back);

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, status, client_email, booked_by, stripe_checkout_session_id")
    .eq("id", bookingId)
    .maybeSingle();

  // Only the client who started this booking can let it go.
  const bookingClient = await createBookingClient();
  const {
    data: { user },
  } = await bookingClient.auth.getUser();
  // (Bookings from before step 6 have no booked_by, so check the email.)
  let isTheirs =
    booking &&
    user &&
    (booking.booked_by
      ? booking.booked_by === user.id
      : Boolean(user.email) && user.email.toLowerCase() === booking.client_email?.toLowerCase());

  // Or they have the waitlist claim link that made this booking.
  if (booking && !isTheirs && claimToken) {
    const { data: offer } = await admin
      .from("waitlist_offers")
      .select("id")
      .eq("booking_id", booking.id)
      .eq("claim_token", claimToken)
      .maybeSingle();
    isTheirs = Boolean(offer);
  }

  if (isTheirs && booking.status === "pending_payment" && booking.stripe_checkout_session_id) {
    const sessionId = booking.stripe_checkout_session_id;
    const stripe = getStripe();
    try {
      await stripe.checkout.sessions.expire(sessionId);
    } catch {
      // Already closed. If it was paid after all, show their confirmation.
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === "paid") {
        return NextResponse.redirect(
          new URL(`/book/${slug}/paid?session_id=${sessionId}`, url.origin)
        );
      }
    }
    await admin.rpc("release_deposit_hold", { p_booking_id: booking.id, p_session_id: sessionId });
  }

  return NextResponse.redirect(back);
}

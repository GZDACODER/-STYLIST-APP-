import { cache } from "react";
import { notFound } from "next/navigation";
import { createBookingClient } from "@/lib/supabase/booking";
import { waitlistConfigured } from "@/lib/waitlist";
import { textsEnabled } from "@/lib/notify";
import { textCodesEnabled } from "@/lib/phone";
import BookingFlow from "./BookingFlow";

// cache() means the title and the page share one database call.
// invite: the secret from a private invite link (?invite=...), if any.
const loadPage = cache(async (slug, invite) => {
  const supabase = await createBookingClient();
  // p_invite is only sent when there is one, so the page still works before
  // the step 8 SQL has been run.
  return supabase.rpc(
    "get_booking_page",
    invite ? { p_slug: slug, p_invite: invite } : { p_slug: slug }
  );
});

function inviteFrom(searchParams) {
  const invite = searchParams?.invite;
  return typeof invite === "string" && /^[0-9a-f]{64}$/.test(invite) ? invite : null;
}

export async function generateMetadata({ params, searchParams }) {
  const { slug } = await params;
  const { data } = await loadPage(slug, inviteFrom(await searchParams));
  return { title: data ? `Book with ${data.business_name}` : "Booking page not found" };
}

export default async function BookingPage({ params, searchParams }) {
  const { slug } = await params;
  const query = await searchParams;
  const { payment } = query;
  const invite = inviteFrom(query);
  const { data, error } = await loadPage(slug, invite);

  if (error) {
    return <p className="message error">This booking page couldn&apos;t load. Please try again.</p>;
  }
  if (!data) notFound();

  return (
    <>
      <h1>Book with {data.business_name}</h1>
      <BookingFlow
        page={data}
        invite={invite}
        paymentCancelled={payment === "cancelled"}
        waitlistReady={waitlistConfigured()}
        textsAvailable={textsEnabled()}
        textCodes={textCodesEnabled()}
      />
    </>
  );
}

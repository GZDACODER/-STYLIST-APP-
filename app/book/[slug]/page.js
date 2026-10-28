import { cache } from "react";
import { notFound } from "next/navigation";
import { createBookingClient } from "@/lib/supabase/booking";
import BookingFlow from "./BookingFlow";

// cache() means the title and the page share one database call.
const loadPage = cache(async (slug) => {
  const supabase = await createBookingClient();
  return supabase.rpc("get_booking_page", { p_slug: slug });
});

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const { data } = await loadPage(slug);
  return { title: data ? `Book with ${data.business_name}` : "Booking page not found" };
}

export default async function BookingPage({ params, searchParams }) {
  const { slug } = await params;
  const { payment } = await searchParams;
  const { data, error } = await loadPage(slug);

  if (error) {
    return <p className="message error">This booking page couldn&apos;t load. Please try again.</p>;
  }
  if (!data) notFound();

  return (
    <>
      <h1>Book with {data.business_name}</h1>
      <BookingFlow page={data} paymentCancelled={payment === "cancelled"} />
    </>
  );
}

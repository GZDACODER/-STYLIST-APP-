// The preview image for a stylist's booking link when it's shared: their
// cover photo with their name, or the black and gold card with their name.
import { brandCard, OG_SIZE } from "@/lib/og/card";
import { displayName, httpsUrl, loadBookingHeader } from "@/lib/bookingHeader";
import { BRAND_NAME } from "@/lib/brand";

export const alt = "Book an appointment";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }) {
  const { slug } = await params;
  const header = await loadBookingHeader(slug);
  const name = displayName(header?.business_name) || BRAND_NAME;
  return brandCard({
    name,
    line: "Book an Appointment",
    photoUrl: httpsUrl(header?.cover_photo_url),
  });
}

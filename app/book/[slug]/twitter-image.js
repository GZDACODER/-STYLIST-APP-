// Same picture as the Open Graph image, for X (Twitter).
import { brandCard, OG_SIZE } from "@/lib/og/card";
import { displayName, httpsUrl, loadBookingHeader } from "@/lib/bookingHeader";
import { BRAND_NAME } from "@/lib/brand";

export const alt = "Book an appointment";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }) {
  const { slug } = await params;
  const header = await loadBookingHeader(slug);
  return brandCard({
    name: displayName(header?.business_name) || BRAND_NAME,
    line: "Book an Appointment",
    photoUrl: httpsUrl(header?.cover_photo_url),
  });
}

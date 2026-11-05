// Same picture as the Open Graph image, for X (Twitter).
import { brandCard, OG_SIZE } from "@/lib/og/card";
import { BRAND_NAME } from "@/lib/brand";

export const alt = `${BRAND_NAME}: Booking that puts your regulars first.`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return brandCard({ name: BRAND_NAME, line: "Booking that puts your regulars first." });
}

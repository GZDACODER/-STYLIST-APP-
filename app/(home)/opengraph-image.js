// The preview image for www.clientelesuite.com when it's shared.
import { brandCard, OG_SIZE } from "@/lib/og/card";
import { BRAND_NAME } from "@/lib/brand";

export const alt = `${BRAND_NAME}: Booking for Hair Stylists`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return brandCard({ name: BRAND_NAME, line: "Booking for Hair Stylists" });
}

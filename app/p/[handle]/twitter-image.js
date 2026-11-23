// Same picture as the Open Graph image, for X (Twitter).
import { brandCard, OG_SIZE } from "@/lib/og/card";
import { displayName } from "@/lib/bookingHeader";
import { loadProfile } from "@/lib/publicProfile";
import { BRAND_NAME } from "@/lib/brand";

export const alt = "A pro's profile";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }) {
  const { handle } = await params;
  const p = await loadProfile(handle);
  return brandCard({
    name: displayName(p?.name) || BRAND_NAME,
    line: p ? [p.type, p.city].filter(Boolean).join(" · ") : "Book online",
    photoUrl: p?.photo || null,
  });
}

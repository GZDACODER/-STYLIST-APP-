// The "Book now" kit images for a booking link: /book/<slug>/kit/qr,
// /kit/story and /kit/card (PNG). Add ?download=1 to save the file. Public,
// like the booking page itself: they only show the name and the link.
import { displayName, httpsUrl, loadBookingHeader } from "@/lib/bookingHeader";
import { publicSiteUrl } from "@/lib/siteUrl";
import { cardImage, qrPng, storyImage } from "@/lib/og/kit";

const FILES = { qr: "qr-code", story: "instagram-story", card: "print-card" };

export async function GET(request, { params }) {
  const { slug, kind } = await params;
  if (!FILES[kind]) return new Response("Not found", { status: 404 });
  const header = await loadBookingHeader(slug);
  if (!header) return new Response("Not found", { status: 404 });

  const origin = new URL(request.url).origin;
  const link = `${publicSiteUrl(origin)}/book/${slug}`;
  const name = displayName(header.business_name) || "Book now";
  const download = new URL(request.url).searchParams.get("download") === "1";
  const headers = {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=600",
    ...(download ? { "Content-Disposition": `attachment; filename="${slug}-${FILES[kind]}.png"` } : {}),
  };

  if (kind === "qr") return new Response(await qrPng(link), { headers });
  const image = kind === "story" ? await storyImage({ name, link, photoUrl: httpsUrl(header.cover_photo_url) }) : await cardImage({ name, link });
  return new Response(image.body, { headers });
}

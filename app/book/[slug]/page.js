import { cache } from "react";
import { notFound } from "next/navigation";
import { createBookingClient } from "@/lib/supabase/booking";
import { waitlistConfigured } from "@/lib/waitlist";
import { textsEnabled } from "@/lib/notify";
import { textCodesEnabled } from "@/lib/phone";
import BookingFlow from "./BookingFlow";
import { displayName } from "@/lib/bookingHeader";
import { BRAND_NAME } from "@/lib/brand";

// cache() means the title and the page share one database call.
// invite: the secret from a private invite link (?invite=...), if any.
const loadPage = cache(async (slug, invite) => {
  const supabase = await createBookingClient();
  // p_invite is only sent when there is one, so the page still works before
  // the step 8 SQL has been run.
  return supabase.rpc(
    "get_booking_page",
    invite ? { p_slug: slug, p_invite: invite } : { p_slug: slug },
  );
});

// A stylist's own look on their page: their accent colour, logo and photo
// replace the defaults when they're set. (The name and cover photo are stored
// today; the rest is used as soon as the booking page data includes it.)
function stylistLook(page) {
  const https = (url) => (typeof url === "string" && /^https:\/\//.test(url) ? url : null);
  const accent = /^#[0-9a-f]{6}$/i.test(page.accent_color || "") ? page.accent_color : null;
  return {
    accent,
    logo: https(page.logo_url),
    photo: https(page.cover_photo_url) || https(page.photos?.[0]),
    name: displayName(page.business_name),
  };
}


function inviteFrom(searchParams) {
  const invite = searchParams?.invite;
  return typeof invite === "string" && /^[0-9a-f]{64}$/.test(invite) ? invite : null;
}

export async function generateMetadata({ params, searchParams }) {
  const { slug } = await params;
  const { data } = await loadPage(slug, inviteFrom(await searchParams));
  if (!data) return { title: "Booking Page Not Found" };

  // What shows when the link is shared (iMessage, Instagram, WhatsApp...).
  // The preview image is ./opengraph-image.js.
  const name = displayName(data.business_name);
  const title = `${name} — Book an Appointment`;
  const tagline = String(data.tagline || "").trim();
  const description = tagline || `Book your next appointment with ${name}.`;
  return {
    title,
    description,
    openGraph: { title, description, siteName: BRAND_NAME, type: "website", url: `/book/${slug}` },
    twitter: { card: "summary_large_image", title, description },
  };
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

  const look = stylistLook(data);

  return (
    <div className="bk-layout" style={look.accent ? { "--accent": look.accent } : undefined}>
      {/* The stylist's name is shown once, as the cursive signature in the
          black panel (over their cover photo, if they've added one). Here
          there's just a small label, or their tagline. */}
      <header className="bk-masthead bk-masthead-quiet">
        {look.logo && <img className="bk-logo" src={look.logo} alt="" decoding="async" />}
        <h1 className="visually-hidden">Book with {look.name}</h1>
        {data.tagline ? (
          <>
            {!look.logo && <p className="bk-kicker">Book with</p>}
            <p className="bk-headline">{data.tagline}</p>
          </>
        ) : (
          !look.logo && <p className="bk-kicker">Reserve your appointment</p>
        )}
      </header>
      {look.photo ? (
        // Cover photo full-bleed, a soft black fade at the bottom, and the
        // name and thin gold rule set on top of it.
        <figure className="bk-visual bk-plate bk-plate-photo">
          <img
            className="bk-plate-img"
            src={look.photo}
            alt=""
            fetchPriority="high"
            decoding="async"
          />
          <figcaption className="bk-plate-name">{look.name}</figcaption>
        </figure>
      ) : (
        // No photo: a solid panel with the stylist's name as a signature (no stock images).
        <div className="bk-visual bk-plate" aria-hidden="true">
          <span className="bk-plate-name">{look.name}</span>
        </div>
      )}
      <div className="bk-flow">
        <BookingFlow
          page={data}
          invite={invite}
          paymentCancelled={payment === "cancelled"}
          waitlistReady={waitlistConfigured()}
          textsAvailable={textsEnabled()}
          textCodes={textCodesEnabled()}
        />
      </div>
    </div>
  );
}

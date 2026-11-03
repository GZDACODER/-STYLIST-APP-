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
    invite ? { p_slug: slug, p_invite: invite } : { p_slug: slug },
  );
});

// A stylist's own look on their page: their accent colour, logo and photo
// replace the defaults when they're set. (Only the name is stored today; the
// rest is used as soon as the booking page data includes it.)
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

// "CUTS BY SAM" -> "Cuts By Sam", so names read in mixed case. Short words
// ("GT", "NYC") stay in capitals, and names already in mixed case are kept.
function displayName(name) {
  const text = String(name || "");
  if (text !== text.toUpperCase() || !/[A-Z]/.test(text)) return text;
  return text.replace(/[A-Z][A-Z']*/g, (word) =>
    word.length <= 3 ? word : word[0] + word.slice(1).toLowerCase(),
  );
}

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

  const look = stylistLook(data);

  return (
    <div className="bk-layout" style={look.accent ? { "--accent": look.accent } : undefined}>
      {/* The stylist's own masthead. */}
      <header className="bk-masthead">
        {look.logo ? (
          <img className="bk-logo" src={look.logo} alt="" decoding="async" />
        ) : (
          <p className="bk-kicker">Book with</p>
        )}
        <h1 className="bk-name">{look.name}</h1>
        {data.tagline && <p className="bk-tagline">{data.tagline}</p>}
      </header>
      {look.photo ? (
        <figure className="bk-visual bk-cover">
          <img src={look.photo} alt={data.business_name} fetchPriority="high" decoding="async" />
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

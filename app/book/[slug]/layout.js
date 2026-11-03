import { cache } from "react";
import { createBookingClient } from "@/lib/supabase/booking";
import { instagramUrl, locationUrl } from "@/lib/profileLinks";

// Just the name and links for the top bar. A separate, read-only call, so
// every booking page (booking, waitlist, claim, paid) can show it.
const loadHeader = cache(async (slug) => {
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("get_booking_header", { p_slug: slug });
  return error ? null : data;
});

export default async function StylistBookingLayout({ children, params }) {
  const { slug } = await params;
  const header = await loadHeader(slug);
  const instagram = instagramUrl(header?.instagram);
  const location = locationUrl(header?.location);

  return (
    <>
      <div className="bk-bar">
        {/* Before the step 10 SQL is run there's no header data: the bar stays
            empty rather than showing the wrong thing. */}
        <span className="bk-bar-name">{header?.business_name || ""}</span>
        {(instagram || location) && (
          <nav className="bk-bar-links" aria-label={`${header.business_name} links`}>
            {instagram && (
              <a href={instagram} target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            )}
            {location && (
              <a href={location} target="_blank" rel="noopener noreferrer">
                Location
              </a>
            )}
          </nav>
        )}
      </div>
      <main className="bk-main">{children}</main>
    </>
  );
}

// The waitlist, claim and paid pages: a smaller version of the booking
// page's black panel (the stylist's cover photo, or black, with their name in
// cursive and a gold rule), next to the page on wide screens and on top on
// phones.
import { displayName, httpsUrl, loadBookingHeader } from "@/lib/bookingHeader";

export default async function StylistShell({ slug, children }) {
  const header = await loadBookingHeader(slug);
  const name = displayName(header?.business_name);
  const photo = httpsUrl(header?.cover_photo_url);

  return (
    <div className="bk-layout bk-layout-small">
      {name && <h1 className="visually-hidden">{name}</h1>}
      {photo ? (
        <figure className="bk-visual bk-plate bk-plate-photo">
          <img className="bk-plate-img" src={photo} alt="" decoding="async" />
          <figcaption className="bk-plate-name">{name}</figcaption>
        </figure>
      ) : (
        name && (
          <div className="bk-visual bk-plate" aria-hidden="true">
            <span className="bk-plate-name">{name}</span>
          </div>
        )
      )}
      <div className="bk-flow">{children}</div>
    </div>
  );
}

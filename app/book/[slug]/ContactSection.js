// The bottom of the booking page: the pro's links (Instagram, TikTok,
// Facebook, website), where to find them (with a map if they turned it on)
// and "See contact details" for their phone and email. Nothing shows for
// anything they left empty.
import { instagramUrl, facebookUrl, locationUrl, mapEmbedUrl } from "@/lib/profileLinks";
import { tiktokUrl, websiteUrl } from "@/lib/profileShared";
import ContactReveal from "./ContactReveal";

export default function ContactSection({ header }) {
  if (!header) return null;
  const links = [
    ["Instagram", instagramUrl(header.instagram)],
    ["TikTok", header.tiktok ? tiktokUrl(header.tiktok) : null],
    ["Facebook", facebookUrl(header.facebook)],
    ["Website", header.website ? websiteUrl(header.website) : null],
  ].filter(([, url]) => url);
  const where = String(header.location || "").trim();
  const mapLink = locationUrl(where);
  const map = header.show_map ? mapEmbedUrl(where) : null;
  const hasContact = Boolean(header.contact_phone || header.contact_email);
  if (!links.length && !where && !hasContact) return null;

  return (
    <section className="bk-contact" aria-labelledby="bk-contact-title">
      <h2 id="bk-contact-title">Contact</h2>
      {links.length > 0 && (
        <ul className="bk-contact-links">
          {links.map(([label, url]) => (
            <li key={label}>
              <a href={url} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            </li>
          ))}
        </ul>
      )}
      {hasContact && <ContactReveal phone={header.contact_phone || ""} email={header.contact_email || ""} />}
      {where && (
        <div className="bk-contact-where">
          <h3>Address</h3>
          {/^https?:\/\//i.test(where) ? null : <p>{where}</p>}
          {map && (
            <iframe
              className="bk-map"
              title={`Map: ${where}`}
              src={map}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          )}
          {mapLink && (
            <a href={mapLink} target="_blank" rel="noopener noreferrer">
              Open in Maps
            </a>
          )}
        </div>
      )}
    </section>
  );
}

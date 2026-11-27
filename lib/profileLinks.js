// The stylist's optional Instagram and location, shown on the booking page.

const HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;

// "@cutsbysam", "cutsbysam" or "https://www.instagram.com/cutsbysam/" -> "cutsbysam".
// Returns "" for empty, or null if it isn't a valid Instagram name.
export function cleanInstagram(text) {
  let value = String(text || "").trim();
  if (!value) return "";
  const fromLink = value.match(/instagram\.com\/([^/?#\s]+)/i);
  if (fromLink) value = fromLink[1];
  value = value.replace(/^@/, "");
  return HANDLE_PATTERN.test(value) ? value : null;
}

export function instagramUrl(handle) {
  const clean = cleanInstagram(handle);
  return clean ? `https://www.instagram.com/${clean}/` : null;
}

// A map link for the stylist's address. A link they pasted (Google or Apple
// Maps) is used as it is; otherwise the address is searched on Google Maps,
// which opens in the Maps app on phones.
export function locationUrl(location) {
  const text = String(location || "").trim();
  if (!text) return null;
  if (/^https:\/\/\S+$/.test(text)) return text;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

// "facebook.com/cutsbysam", "fb.com/cutsbysam" or "cutsbysam" -> the page's
// link. Returns "" for empty, or null if it isn't a Facebook name or link.
export function cleanFacebook(text) {
  let value = String(text || "").trim();
  if (!value) return "";
  const fromLink = value.match(/(?:facebook|fb)\.com\/((?:profile\.php\?id=\d+)|[^/?#\s]+)/i);
  if (fromLink) value = fromLink[1];
  value = value.replace(/^@/, "");
  return /^(profile\.php\?id=\d+|[A-Za-z0-9.]{5,50})$/.test(value) ? value : null;
}

export function facebookUrl(name) {
  const clean = cleanFacebook(name);
  return clean ? `https://www.facebook.com/${clean}` : null;
}

// A phone number to show: digits and + ( ) . - spaces, 7 to 15 digits.
// "" for empty, null if it doesn't look like a phone number.
export function cleanPhone(text) {
  const value = String(text || "").trim().replace(/\s+/g, " ");
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  return /^[0-9+(). -]{7,25}$/.test(value) && digits.length >= 7 && digits.length <= 15 ? value : null;
}

export const phoneHref = (phone) => `tel:${String(phone || "").replace(/[^0-9+]/g, "")}`;

export function cleanContactEmail(text) {
  const value = String(text || "").trim().toLowerCase();
  if (!value) return "";
  return value.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

// A Google map of the address for the booking page. Only for a typed
// address (a pasted map link stays a link), and only when the pro turned
// the map on.
export function mapEmbedUrl(location) {
  const text = String(location || "").trim();
  if (!text || /^https?:\/\//i.test(text)) return null;
  return `https://www.google.com/maps?q=${encodeURIComponent(text)}&output=embed`;
}

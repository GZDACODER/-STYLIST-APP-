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

// The app's public web address, used to build the links stylists share with
// clients (their booking link and invite links), so they're the same
// wherever the stylist is looking from (a preview, another domain...).
// Set NEXT_PUBLIC_SITE_URL in Vercel, like https://stylist-app-uran.vercel.app
// Until it's set, the address of the current page is used.
export function publicSiteUrl(fallbackOrigin = "") {
  const value = String(process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  return /^https?:\/\/[^\s/]+$/.test(value) ? value : fallbackOrigin;
}

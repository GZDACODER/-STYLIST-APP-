// Public profile helpers safe for the browser too (no secrets).

export const HANDLE_RE = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

// Handles that would look official or clash with site pages.
const RESERVED = new Set(
  "admin administrator api app book booking bookings client clients clientele clientelesuite dashboard demo find help home login logout my null p pro pros privacy root search settings signup staff support team terms test undefined v www mail email billing pricing about contact blog".split(" ")
);

export const PROFILE_SHOW_KEYS = [
  ["prices", "Prices"],
  ["portfolio", "Portfolio photos"],
  ["reviews", "Reviews and ratings"],
  ["hours", "Hours"],
  ["openings", "Next open times"],
];
export const DEFAULT_SHOW = { prices: true, portfolio: true, reviews: true, hours: true, openings: true };

// "Ink by Rosa!" -> "ink-by-rosa".
export function cleanHandle(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

// null when it's fine, otherwise the reason.
export function handleProblem(handle) {
  if (!handle) return "Choose a profile link.";
  if (!HANDLE_RE.test(handle)) return "Use 3 to 30 letters, numbers or dashes (no dash at the start or end).";
  if (RESERVED.has(handle)) return "That link is reserved. Please choose another.";
  return null;
}

export function websiteUrl(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export function tiktokUrl(text) {
  let v = String(text || "").trim();
  if (!v) return null;
  const m = v.match(/tiktok\.com\/@?([^/?#\s]+)/i);
  if (m) v = m[1];
  v = v.replace(/^@/, "");
  return /^[A-Za-z0-9._]{2,24}$/.test(v) ? `https://www.tiktok.com/@${v}` : null;
}

// A service's description: the short line under it on the booking page.
// One line, at most 300 characters (services_description_length, 0077 SQL).
// Pure; relative imports only.
export const DESCRIPTION_MAX = 300;

export function cleanDescription(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim().slice(0, DESCRIPTION_MAX);
}

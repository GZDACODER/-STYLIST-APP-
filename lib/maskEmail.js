// Hides most of a client's email on the public booking pages, so it isn't
// readable over their shoulder or in a screenshot:
// "tauraungardner3@gmail.com" -> "tau…@gmail.com".
// Very short names keep only their first letter ("ab@x.com" -> "a…@x.com").
// The stylist dashboard always shows the full email; don't use this there.
export function maskEmail(email) {
  const text = String(email || "").trim();
  const at = text.lastIndexOf("@");
  if (at < 1) return text;
  const name = text.slice(0, at);
  const domain = text.slice(at);
  const shown = name.length > 3 ? name.slice(0, 3) : name.slice(0, 1);
  return `${shown}…${domain}`;
}

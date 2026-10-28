// Phone number helpers, shared by the booking page and its server code.
// US numbers are assumed unless they start with "+".

// "(555) 123-4567" -> "+15551234567". Returns null if it doesn't look right.
export function normalizePhone(input) {
  const text = String(input || "").trim();
  const digits = text.replace(/\D/g, "");
  if (text.startsWith("+")) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// "+15551234567" (or "15551234567") -> "(555) 123-4567".
export function formatPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return digits ? `+${digits}` : "";
}

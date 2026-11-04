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

// For showing a phone number to the stylist: US numbers as "(773) 890-0000",
// whether they were saved with or without the leading 1. Anything else is
// shown as it was typed. (Display only; the saved number doesn't change.)
export function displayPhone(phone) {
  const text = String(phone || "").trim();
  const digits = text.replace(/\D/g, "");
  const us = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (us.length === 10) return `(${us.slice(0, 3)}) ${us.slice(3, 6)}-${us.slice(6)}`;
  return text;
}

// Text message codes for confirming clients. Off for now: clients confirm by
// email code (they still type their phone number when booking). To switch
// texts back on, add TEXT_CODES=on in Vercel and redeploy (see PHONE_SETUP.md).
// Server code only: the browser can't read this setting.
export function textCodesEnabled() {
  return String(process.env.TEXT_CODES || "").toLowerCase() === "on";
}

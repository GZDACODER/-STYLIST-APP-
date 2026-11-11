export function formatPrice(cents) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100
  );
}

// "40", "$40", "40.5", "1,200.00" -> cents. "" -> null. Anything else -> NaN.
export function parseDollars(text) {
  const clean = String(text ?? "").replace(/[$,\s]/g, "");
  if (!clean) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return NaN;
  return Math.round(Number(clean) * 100);
}

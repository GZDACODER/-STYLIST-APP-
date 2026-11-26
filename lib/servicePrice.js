// A service's price for clients: "Free" for a free service (e.g. a consultation).
export function servicePrice(cents) {
  if (!cents) return "Free";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

// A pro taking deposits always has a cancellation policy clients can read:
// this plain default fills in when they haven't written their own (they can
// change it in Settings > Deposits).
export const DEFAULT_DEPOSIT_POLICY =
  "Please give at least 24 hours' notice to cancel or move your appointment. Your deposit comes off the price of your visit. Deposits for late cancellations or no-shows may not be refunded.";

export function policyOrDefault(policy) {
  const p = String(policy || "").trim();
  return p || DEFAULT_DEPOSIT_POLICY;
}

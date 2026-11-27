// "Pay over time": Klarna, Afterpay and Affirm on deposits and payment links
// (0082 SQL, pro's opt-in stylists.pay_later_on). The client picks it on its
// own button, so the Stripe page is made for those methods only, with their
// higher fee (6% + 30 cents: they cost about 6% + 30 cents). Everything else
// leaves them out, so the 3% + 30 cent fee always covers the card cost.
// Pure helpers, shared by the pages and the tests.

export const PAY_LATER_TYPES = ["klarna", "afterpay_clearpay", "affirm"];
export const PAY_LATER_MIN_CENTS = 5000; // $50, like the others offer it
export const PAY_LATER_FEE_PERCENT = 6;
export const PAY_LATER_FEE_FIXED_CENTS = 30;

// Each method's US limits, in cents.
const LIMITS = {
  klarna: [1000, 1000000],
  afterpay_clearpay: [100, 400000],
  affirm: [5000, 3000000],
};

export function payLaterFeeCents(amountCents) {
  const fee = Math.round((amountCents * PAY_LATER_FEE_PERCENT) / 100) + PAY_LATER_FEE_FIXED_CENTS;
  return Math.max(0, Math.min(amountCents, fee));
}

// The methods that can take this amount, of those switched on in Stripe.
export function payLaterTypes(amountCents, available = PAY_LATER_TYPES) {
  if (!(amountCents >= PAY_LATER_MIN_CENTS)) return [];
  return PAY_LATER_TYPES.filter((t) => available.includes(t) && amountCents >= LIMITS[t][0] && amountCents <= LIMITS[t][1]);
}

const NAMES = { klarna: "Klarna", afterpay_clearpay: "Afterpay", affirm: "Affirm" };
// "Klarna or Afterpay", "Klarna, Afterpay or Affirm".
export function payLaterNames(types) {
  const names = types.map((t) => NAMES[t]);
  return names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

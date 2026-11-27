// Where a client pays a deposit or gift card: our page with Apple Pay /
// Google Pay (/pay/c/[session], lib/walletCheckout.js) once the publishable
// key is in Vercel, else Stripe's page as before. No imports, so the Stripe
// helpers can use it.

// True once the publishable key is set (the wallet buttons need it).
export const walletsEnabled = () => String(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").startsWith("pk_");

export function paymentPageUrl(origin, session) {
  return walletsEnabled() ? `${origin}/pay/c/${session.id}` : session.url;
}

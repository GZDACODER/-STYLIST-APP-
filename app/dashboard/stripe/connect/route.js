// "Connect Stripe" on the Settings tab opens this. It makes the stylist's own
// Stripe account (the first time only), then sends them to Stripe to fill in
// their details. Stripe also sends them back here if that link expires.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, paymentsConfigured } from "@/lib/stripe";

export async function GET(request) {
  const origin = new URL(request.url).origin;
  const settings = (status) => NextResponse.redirect(`${origin}/dashboard/settings?stripe=${status}`);

  if (!paymentsConfigured()) return settings("not_configured");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data: stylist } = await supabase
    .from("stylists")
    .select("business_name, stripe_account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!stylist) return NextResponse.redirect(`${origin}/dashboard`);

  try {
    const stripe = getStripe();
    let accountId = stylist.stripe_account_id;

    if (!accountId) {
      const account = await stripe.accounts.create(
        {
          type: "express",
          country: "US",
          email: user.email,
          business_profile: { name: stylist.business_name, mcc: "7230" }, // 7230 = hair salons
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          metadata: { stylist_id: user.id },
        },
        // A double tap still makes only one account.
        { idempotencyKey: `connect-account-${user.id}` }
      );
      accountId = account.id;

      const { error } = await createAdminClient()
        .from("stylists")
        .update({ stripe_account_id: accountId, stripe_charges_enabled: false })
        .eq("id", user.id);
      if (error) throw error;
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      type: "account_onboarding",
      refresh_url: `${origin}/dashboard/stripe/connect`,
      return_url: `${origin}/dashboard/settings?stripe=return`,
    });
    return NextResponse.redirect(link.url);
  } catch (error) {
    console.error("Stripe connect failed", error);
    return settings("error");
  }
}

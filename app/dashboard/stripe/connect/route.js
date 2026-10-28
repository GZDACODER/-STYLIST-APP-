// "Connect Stripe" on the Settings tab opens this. It makes the stylist's own
// Stripe account (the first time only), then sends them to Stripe to fill in
// their details. Stripe also sends them back here if that link expires.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, paymentsConfigured } from "@/lib/stripe";

export async function GET(request) {
  const origin = new URL(request.url).origin;
  const settings = (status, reason = "") =>
    NextResponse.redirect(
      `${origin}/dashboard/settings?stripe=${status}` +
        (reason ? `&reason=${encodeURIComponent(reason.slice(0, 300))}` : "")
    );

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
      // Stripe's Accounts v2. The stylist gets an Express account: Stripe
      // collects their details and gives them a simple Stripe dashboard.
      // "recipient" means the account receives deposits that this app passes
      // on to it (destination charges).
      const account = await stripe.v2.core.accounts.create(
        {
          contact_email: user.email,
          display_name: stylist.business_name,
          dashboard: "express",
          identity: { country: "us" },
          defaults: {
            currency: "usd",
            // Stripe sets the stylist's Stripe pricing and covers it if their
            // account can't pay back a refund or dispute, so the platform
            // isn't on the hook.
            responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
            profile: {
              doing_business_as: stylist.business_name,
              product_description: "Hair salon appointments",
            },
          },
          configuration: {
            recipient: {
              capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
            },
          },
          metadata: { stylist_id: user.id },
        },
        // A double tap within the same minute still makes only one account.
        // (Kept short so a failed try isn't replayed for Stripe's 24 hours.)
        { idempotencyKey: `connect-account-${user.id}-${Math.floor(Date.now() / 60000)}` }
      );
      accountId = account.id;

      const { error } = await createAdminClient()
        .from("stylists")
        .update({ stripe_account_id: accountId, stripe_charges_enabled: false })
        .eq("id", user.id);
      if (error) throw new Error(`Saving to Supabase failed: ${error.message}`);
    }

    const link = await stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: "account_onboarding",
        account_onboarding: {
          refresh_url: `${origin}/dashboard/stripe/connect`,
          return_url: `${origin}/dashboard/settings?stripe=return`,
        },
      },
    });
    return NextResponse.redirect(link.url);
  } catch (error) {
    console.error("Stripe connect failed", error);
    // Show the real reason on Settings, so it can be fixed.
    return settings("error", error?.raw?.message || error?.message || "");
  }
}

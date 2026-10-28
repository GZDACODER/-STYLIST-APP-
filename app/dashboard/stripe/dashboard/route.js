// "Open Stripe" on the Settings tab: signs the stylist in to their own Stripe
// dashboard, where they see payments, refunds and payouts to their bank.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, paymentsConfigured } from "@/lib/stripe";

export async function GET(request) {
  const origin = new URL(request.url).origin;
  if (!paymentsConfigured()) return NextResponse.redirect(`${origin}/dashboard/settings`);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const { data: stylist } = await supabase
    .from("stylists")
    .select("stripe_account_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!stylist?.stripe_account_id) return NextResponse.redirect(`${origin}/dashboard/settings`);

  try {
    const link = await getStripe().accounts.createLoginLink(stylist.stripe_account_id);
    return NextResponse.redirect(link.url);
  } catch (error) {
    // Usually means they haven't finished signing up with Stripe yet.
    console.error("Stripe login link failed", error);
    return NextResponse.redirect(`${origin}/dashboard/stripe/connect`);
  }
}

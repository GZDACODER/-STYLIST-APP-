// "Manage billing": opens Stripe's own billing page, where the stylist can
// change their card, switch plans, see receipts or cancel.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, paymentsConfigured } from "@/lib/stripe";
import { publicSiteUrl } from "@/lib/siteUrl";

export async function GET(request) {
  const site = publicSiteUrl(new URL(request.url).origin);
  const back = `${site}/dashboard/settings`;
  if (!paymentsConfigured()) return NextResponse.redirect(back);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${site}/login`);

  const { data: plan } = await supabase
    .from("stylist_plans")
    .select("stripe_customer_id")
    .eq("stylist_id", user.id)
    .maybeSingle();
  if (!plan?.stripe_customer_id) return NextResponse.redirect(back);

  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: plan.stripe_customer_id,
      return_url: back,
    });
    return NextResponse.redirect(session.url);
  } catch (error) {
    console.error("Couldn't open Stripe billing page", error);
    return NextResponse.redirect(`${back}?billing=portal_error`);
  }
}

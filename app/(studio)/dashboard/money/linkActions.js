"use server";

// Payment links (0080 SQL): make one (from Money → Payment links, or from a
// balance owed) and cancel one. Needs Stripe payouts connected, since the
// money goes straight to the pro's own Stripe account.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";
import { formatDate } from "@/lib/availability";
import { checkLink, linkShareText, newLinkToken } from "@/lib/paymentLinks";
import { publicSiteUrl } from "@/lib/siteUrl";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const siteUrl = () => publicSiteUrl("https://www.clientelesuite.com");

export async function createPaymentLink(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };

  const { data: s } = await supabase.from("stylists").select("business_name, stripe_account_id, stripe_charges_enabled").eq("id", user.id).maybeSingle();
  if (!s?.stripe_account_id || !s.stripe_charges_enabled) {
    return { error: "Connect Stripe first (Settings → Deposits), so payments can go to your account." };
  }

  // From a balance owed: the visit's client and a ready description.
  let booking = null;
  const bookingId = String(formData.get("booking_id") || "");
  if (/^[0-9a-f-]{36}$/i.test(bookingId)) {
    const { data } = await supabase.from("bookings").select("id, client_id, client_name, service_name, booking_date").eq("id", bookingId).maybeSingle();
    if (!data) return { error: "That visit isn't there any more." };
    booking = data;
  }
  const checked = checkLink({
    amount: formData.get("amount"),
    description: formData.get("description") || (booking ? `Balance for ${booking.service_name} on ${formatDate(booking.booking_date)}` : ""),
    clientName: formData.get("client_name") || booking?.client_name || "",
  });
  if (checked.error) return { error: checked.error };

  const token = newLinkToken();
  const { error } = await supabase.from("payment_links").insert({
    token,
    stylist_id: user.id,
    booking_id: booking?.id || null,
    client_id: booking?.client_id || null,
    client_name: checked.clientName,
    amount_cents: checked.amountCents,
    description: checked.description,
  });
  if (error) {
    console.error("Payment link: couldn't create", error.message);
    return { error: "The link couldn't be made. Please try again." };
  }
  revalidatePath("/dashboard/money");
  return {
    success: "Payment link ready. Share it below.",
    link: { url: `${siteUrl()}/pay/${token}`, message: linkShareText(s.business_name, checked.amountCents, checked.description), businessName: s.business_name },
  };
}

export async function cancelPaymentLink(formData) {
  const { supabase, user } = await me();
  if (!user || isDemo(user)) return;
  await supabase.from("payment_links").update({ status: "cancelled" }).eq("id", String(formData.get("id") || "")).eq("status", "open");
  revalidatePath("/dashboard/money");
}

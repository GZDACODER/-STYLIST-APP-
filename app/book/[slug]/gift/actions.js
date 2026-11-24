"use server";

// Buying a gift card: checks, then off to Stripe's payment page.
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGiftCheckout, GIFT_MAX, GIFT_MIN } from "@/lib/giftCards";
import { isDemoSlug } from "@/lib/demo";
import { siteOrigin } from "@/lib/stripe";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function buyGiftCard(prev, formData) {
  const slug = String(formData.get("slug") || "");
  if (isDemoSlug(slug)) return { error: "This is a demo page, so gift cards are switched off." };
  const admin = createAdminClient();
  const { data: s } = await admin
    .from("stylists")
    .select("id, slug, business_name, stripe_account_id, stripe_charges_enabled, gift_cards_on")
    .eq("slug", slug)
    .maybeSingle();
  if (!s?.gift_cards_on || !s.stripe_account_id || !s.stripe_charges_enabled) return { error: "Gift cards aren't available here right now." };
  const custom = String(formData.get("custom") || "").replace(/[$,\s]/g, "");
  const amountCents = Math.round(Number(formData.get("amount") === "custom" ? custom : formData.get("amount")) * (formData.get("amount") === "custom" ? 100 : 1));
  if (!(amountCents >= GIFT_MIN && amountCents <= GIFT_MAX)) return { error: "Choose an amount from $10 to $1,000." };
  const buyerName = String(formData.get("buyer_name") || "").trim().slice(0, 100);
  const buyerEmail = String(formData.get("buyer_email") || "").trim().slice(0, 200);
  const recipientName = String(formData.get("recipient_name") || "").trim().slice(0, 100);
  const recipientEmail = String(formData.get("recipient_email") || "").trim().slice(0, 200);
  const message = String(formData.get("message") || "").trim().slice(0, 300);
  if (!buyerName || !recipientName) return { error: "Please add both names." };
  if (!EMAIL_RE.test(buyerEmail)) return { error: "Please check your email address." };
  if (recipientEmail && !EMAIL_RE.test(recipientEmail)) return { error: "Please check their email address." };
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const { data: ok } = await admin.rpc("rate_ok", { p_bucket: `gift:${ip}`, p_max: 10, p_window: "1 hour" });
  if (ok === false) return { error: "Too many tries. Please try again later." };
  let url;
  try {
    url = await createGiftCheckout({ stylist: s, amountCents, buyerName, buyerEmail, recipientName, recipientEmail, message, origin: await siteOrigin() });
  } catch {
    return { error: "Couldn't start the payment. Please try again." };
  }
  redirect(url);
}

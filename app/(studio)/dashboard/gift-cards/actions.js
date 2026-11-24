"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";
import { cleanGiftCode } from "@/lib/giftCards";
import { formatPrice } from "@/lib/money";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function setGiftCards(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const on = formData.get("on") === "true";
  const { error } = await supabase.from("stylists").update({ gift_cards_on: on }).eq("id", user.id);
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/dashboard/gift-cards");
  return { success: on ? "Gift cards are on. Share the link below." : "Gift cards are off. Cards already sold still work." };
}

export async function redeemGift(prev, formData) {
  const { user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const code = cleanGiftCode(formData.get("code"));
  if (!code) return { error: "Codes look like GIFT-AB2C-DE3F." };
  const amount = Math.round(Number(String(formData.get("amount") || "").replace(/[$,\s]/g, "")) * 100);
  if (!(amount > 0)) return { error: "Enter the amount to take off, like 40 or 12.50." };
  const { data, error } = await createAdminClient().rpc("redeem_gift_card", {
    p_stylist_id: user.id,
    p_code: code,
    p_amount: amount,
    p_note: String(formData.get("note") || ""),
  });
  if (error) {
    if (/not_found/.test(error.message)) return { error: "No gift card with that code." };
    if (/not_active/.test(error.message)) return { error: "That card isn't active (not paid yet, used up or cancelled)." };
    if (/too_much/.test(error.message)) return { error: "That's more than the card has left." };
    return { error: "Couldn't redeem. Please try again." };
  }
  revalidatePath("/dashboard/gift-cards");
  return { success: `Took ${formatPrice(amount)} off ${code}. ${formatPrice(data)} left on it.`, at: Date.now() };
}

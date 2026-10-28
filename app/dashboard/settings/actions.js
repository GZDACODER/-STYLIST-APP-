"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/availability";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function saveSettings(prevState, formData) {
  const businessName = String(formData.get("business_name") || "").trim();
  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const timezone = String(formData.get("timezone") || "").trim();

  if (!businessName) return { error: "Please enter your business name." };
  if (businessName.length > 100) return { error: "Business name is too long." };
  if (slug.length < 3 || slug.length > 40 || !SLUG_PATTERN.test(slug)) {
    return {
      error:
        "Your link can use lowercase letters, numbers and single dashes (3 to 40 characters), like cuts-by-sam.",
    };
  }
  if (!isValidTimeZone(timezone)) return { error: "Please pick your time zone." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const { error } = await supabase
    .from("stylists")
    .update({ business_name: businessName, slug, timezone })
    .eq("id", user.id);

  if (error) {
    // 23505 = "unique violation": another stylist already has this link.
    if (error.code === "23505") return { error: "That link is already taken. Try another." };
    return { error: error.message };
  }

  // Name, link and time zone show up across the whole dashboard.
  revalidatePath("/dashboard", "layout");
  return { success: "Settings saved." };
}

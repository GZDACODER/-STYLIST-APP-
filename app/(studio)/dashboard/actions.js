"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// "Create my stylist account" for a login that has no stylist profile.
export async function createMyStylist(prevState, formData) {
  const businessName = String(formData.get("business_name") || "").trim();
  const firstName = String(formData.get("first_name") || "").trim();
  if (!businessName) return { error: "Please enter your business name." };
  if (businessName.length > 100) return { error: "Business name is too long." };
  if (firstName.length > 50) return { error: "Please keep your first name to 50 characters." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_my_stylist", {
    p_business_name: businessName,
    p_first_name: firstName,
  });
  if (error) {
    console.error("Couldn't create stylist profile", error.code, error.message);
    if (/create_my_stylist/.test(error.message)) {
      return { error: "Run supabase/migrations/0018_stylist_profile_repair.sql in Supabase first." };
    }
    return { error: `Your account couldn't be created: ${error.message}` };
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

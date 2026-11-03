"use server";

// Server actions for adding and removing services.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addService(prevState, formData) {
  const name = String(formData.get("name") || "").trim();
  const priceText = String(formData.get("price") || "").trim();
  const durationText = String(formData.get("duration_minutes") || "").trim();
  const values = { name, price: priceText, duration_minutes: durationText };

  const price = Number(priceText);
  const duration = Number(durationText);

  if (!name) return { error: "Please enter a service name.", values };
  if (name.length > 100) return { error: "Service name is too long.", values };
  if (priceText === "" || !Number.isFinite(price) || price < 0) {
    return { error: "Please enter a price of 0 or more.", values };
  }
  if (!Number.isInteger(duration) || duration < 5 || duration > 600) {
    return { error: "Duration must be a whole number of minutes, from 5 to 600.", values };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again.", values };

  const { error } = await supabase.from("services").insert({
    stylist_id: user.id,
    name,
    // Money is stored in cents (e.g. $45.50 -> 4550) to avoid rounding errors.
    price_cents: Math.round(price * 100),
    duration_minutes: duration,
  });

  if (error) return { error: error.message, values };

  revalidatePath("/dashboard");
  return { success: `Added "${name}".` };
}

export async function deleteService(formData) {
  const id = String(formData.get("id") || "");
  const supabase = await createClient();

  // The database's security rules only let a stylist delete their own services.
  await supabase.from("services").delete().eq("id", id);

  revalidatePath("/dashboard");
}

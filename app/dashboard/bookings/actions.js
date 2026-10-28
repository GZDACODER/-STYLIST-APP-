"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function cancelBooking(formData) {
  const id = String(formData.get("id") || "");
  const supabase = await createClient();

  // The database's security rules only let a stylist change their own bookings.
  await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/openings");
}

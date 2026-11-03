"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/stripe";
import { runWaitlistSafely } from "@/lib/waitlist";

export async function cancelBooking(formData) {
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // The database's security rules only let a stylist change their own bookings.
  const { data: cancelled } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("status", "confirmed")
    .select("id");

  // The time is free again: tell anyone on the waitlist who wants it.
  if (cancelled?.length) await runWaitlistSafely(user.id, await siteOrigin());

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/openings");
  revalidatePath("/dashboard/waitlist");
}

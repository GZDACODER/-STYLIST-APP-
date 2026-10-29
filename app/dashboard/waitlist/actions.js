"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Minutes regulars get before everyone else hears about a time. 0 = nobody waits.
const HEAD_STARTS = [0, 10, 15, 30, 45, 60, 90, 120, 180, 240];

export async function saveWaitlistSettings(prevState, formData) {
  const enabled = formData.get("waitlist_enabled") === "on";
  const minutes = Number(formData.get("waitlist_regulars_minutes"));
  if (!HEAD_STARTS.includes(minutes)) return { error: "Please pick how long regulars get." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const { error } = await supabase
    .from("stylists")
    .update({ waitlist_enabled: enabled, waitlist_regulars_minutes: minutes })
    .eq("id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/waitlist");
  return {
    success: enabled
      ? "Saved. Clients can join your waitlist from your booking page."
      : "Saved. The waitlist is off: clients can't join, and nobody is told about new times.",
  };
}

export async function removeWaitlistEntry(formData) {
  const id = String(formData.get("id") || "");
  const supabase = await createClient();
  // The database's security rules only let a stylist change their own waitlist.
  await supabase
    .from("waitlist_entries")
    .update({ status: "removed", ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "waiting");
  revalidatePath("/dashboard/waitlist");
}

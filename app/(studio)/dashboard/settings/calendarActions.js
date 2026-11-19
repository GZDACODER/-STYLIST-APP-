"use server";

// Settings → Calendar sync: a new private link (the old one stops working).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function resetCalendarFeed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  const { data, error } = await supabase.rpc("reset_my_calendar_feed");
  if (error || !data) return { error: "Couldn't make a new link. Please try again." };
  revalidatePath("/dashboard/settings/calendar");
  return { ok: true };
}

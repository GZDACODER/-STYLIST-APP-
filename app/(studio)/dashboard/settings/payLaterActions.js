"use server";

// Settings → Deposits → Pay over time (0082 SQL, stylists.pay_later_on).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";
import { blockedInHelpMode } from "@/lib/helpModeServer";

export async function savePayLater(prev, formData) {
  const block = await blockedInHelpMode();
  if (block) return block;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const on = formData.get("pay_later") === "on";
  const { error } = await supabase.from("stylists").update({ pay_later_on: on }).eq("id", user.id);
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/dashboard/settings", "layout");
  revalidatePath("/book", "layout");
  return { success: on ? "On. Clients see Pay over time on payments of $50 or more." : "Off." };
}

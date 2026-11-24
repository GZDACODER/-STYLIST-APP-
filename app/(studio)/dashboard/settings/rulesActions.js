"use server";

// Settings > Booking rules and Settings > Notifications (step 66 SQL).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";
import { NOTIFY_KINDS } from "@/lib/waitlist";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

const num = (v, lo, hi) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null;
};

export async function saveRules(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const step = Number(formData.get("slot_step_minutes"));
  const limitRaw = String(formData.get("daily_limit") || "").trim();
  const update = {
    min_notice_minutes: num(formData.get("min_notice_minutes"), 0, 20160),
    max_days_ahead: num(formData.get("max_days_ahead"), 1, 365),
    buffer_minutes: num(formData.get("buffer_minutes"), 0, 120),
    slot_step_minutes: [15, 30, 60].includes(step) ? step : 15,
    daily_limit: limitRaw === "" || limitRaw === "0" ? null : num(limitRaw, 1, 40),
  };
  if ([update.min_notice_minutes, update.max_days_ahead, update.buffer_minutes].some((v) => v === null)) return { error: "Please check the numbers." };
  const { error } = await supabase.from("stylists").update(update).eq("id", user.id);
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/dashboard/settings/rules");
  return { success: "Saved. Your booking page uses these rules now." };
}

export async function saveNotify(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const notify = Object.fromEntries(NOTIFY_KINDS.map(([k]) => [k, formData.get(k) === "on"]));
  const { error } = await supabase.from("stylists").update({ notify }).eq("id", user.id);
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/dashboard/settings/notifications");
  return { success: "Saved." };
}

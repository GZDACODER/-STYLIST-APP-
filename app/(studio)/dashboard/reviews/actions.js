"use server";

// Reviews: the pro chooses which written reviews show on their public
// profile, and can reply publicly (step 58 SQL).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

async function refreshProfile(supabase, userId) {
  revalidatePath("/dashboard/reviews");
  const { data } = await supabase.from("stylists").select("handle").eq("id", userId).maybeSingle();
  if (data?.handle) {
    revalidatePath(`/p/${data.handle}`);
    revalidatePath(`/p/${data.handle}/reviews`);
  }
}

export async function setReviewPublic(formData) {
  const { supabase, user } = await me();
  if (!user || isDemo(user)) return;
  await supabase
    .from("visit_feedback")
    .update({ is_public: formData.get("on") === "true" })
    .eq("booking_id", String(formData.get("id")))
    .eq("stylist_id", user.id);
  await refreshProfile(supabase, user.id);
}

export async function saveReply(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const reply = String(formData.get("reply") || "").trim().slice(0, 1000);
  const { error } = await supabase
    .from("visit_feedback")
    .update({ reply: reply || null, replied_at: reply ? new Date().toISOString() : null })
    .eq("booking_id", String(formData.get("id")))
    .eq("stylist_id", user.id);
  if (error) return { error: "Couldn't save. Please try again." };
  await refreshProfile(supabase, user.id);
  return { success: reply ? "Reply saved." : "Reply removed." };
}

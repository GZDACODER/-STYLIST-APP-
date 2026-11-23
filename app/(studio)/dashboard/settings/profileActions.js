"use server";

// Settings > Public profile (step 57 SQL).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";
import { cleanHandle, handleProblem, PROFILE_SHOW_KEYS, tiktokUrl, websiteUrl } from "@/lib/profileShared";

const text = (formData, key, max) => String(formData.get(key) || "").trim().slice(0, max);

export async function saveProfile(prev, formData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };

  const handle = cleanHandle(formData.get("handle"));
  const problem = handleProblem(handle);
  if (problem) return { error: problem, values: Object.fromEntries(formData) };
  const { data: taken } = await createAdminClient().from("stylists").select("id").eq("handle", handle).neq("id", user.id).maybeSingle();
  if (taken) return { error: `clientelesuite.com/p/${handle} is taken. Please try another.`, values: Object.fromEntries(formData) };

  const tiktok = text(formData, "tiktok", 80);
  const website = text(formData, "website", 200);
  if (tiktok && !tiktokUrl(tiktok)) return { error: "That TikTok name doesn't look right (e.g. @inkbyrosa).", values: Object.fromEntries(formData) };
  if (website && !websiteUrl(website)) return { error: "That website address doesn't look right.", values: Object.fromEntries(formData) };
  const yearsRaw = text(formData, "years", 3);
  const years = yearsRaw === "" ? null : Math.max(0, Math.min(80, parseInt(yearsRaw, 10) || 0));

  const profileOn = formData.get("profile_on") === "on";
  const update = {
    handle,
    profile_on: profileOn,
    // Search needs the profile on.
    in_search: profileOn && formData.get("in_search") === "on",
    owner_name: text(formData, "owner_name", 80) || null,
    city: text(formData, "city", 80) || null,
    bio: text(formData, "bio", 1200) || null,
    specialties: text(formData, "specialties", 300) || null,
    years_in_business: years,
    tiktok: tiktok || null,
    website: website || null,
    profile_show: Object.fromEntries(PROFILE_SHOW_KEYS.map(([k]) => [k, formData.get(`show_${k}`) === "on"])),
  };
  const { error } = await supabase.from("stylists").update(update).eq("id", user.id);
  if (error) {
    if (/handle/.test(error.message)) return { error: "That link is taken. Please try another.", values: Object.fromEntries(formData) };
    return { error: "Couldn't save. Please try again.", values: Object.fromEntries(formData) };
  }
  revalidatePath("/dashboard/settings/profile");
  revalidatePath(`/p/${handle}`);
  return {
    success: profileOn
      ? `Saved. Your profile is live at clientelesuite.com/p/${handle}.`
      : "Saved. Your profile is off; only you can preview it.",
    handle,
  };
}

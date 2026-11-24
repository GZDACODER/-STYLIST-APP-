"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { SUPPORT_LENGTHS } from "@/lib/support";

// Settings > Business type: switch the pro's type (lib/templates) and turn
// features on or off; Settings > Support access: the switch and its log.
// Switching type never touches bookings, clients, notes or services: only
// the words, example data and which features show change.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { MODULE_LABELS, TYPE_CHOICES, templateFor } from "@/lib/templates";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function saveBusinessType(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const type = String(formData.get("business_type") || "");
  if (!TYPE_CHOICES.some((t) => t.value === type)) return { error: "Please pick a business type." };
  // Their own feature choices are kept; the new type's defaults fill the rest.
  const { error } = await supabase.from("stylists").update({ business_type: type }).eq("id", user.id);
  if (error) return { error: "Couldn't save. Please try again." };
  revalidatePath("/dashboard", "layout");
  return { success: `Switched to ${templateFor(type).label}. Your bookings, clients and notes are all still here.` };
}

export async function saveModules(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const { data: row } = await supabase.from("stylists").select("business_type").eq("id", user.id).maybeSingle();
  const defaults = templateFor(row?.business_type).modules;
  // Save only what differs from the template, so a later template change
  // still brings its own defaults for anything they haven't chosen.
  const modules = {};
  for (const key of Object.keys(MODULE_LABELS)) {
    const on = formData.get(`m_${key}`) === "on";
    if (on !== defaults[key]) modules[key] = on;
  }
  const { error } = await supabase.from("stylists").update({ modules }).eq("id", user.id);
  if (error) return { error: "Couldn't save. Run step 51 SQL (0056_business_templates.sql) if you haven't." };
  revalidatePath("/dashboard", "layout");
  return { success: "Saved." };
}

export async function setSupportAccess(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const choice = String(formData.get("length") || "off");
  const length = SUPPORT_LENGTHS.find(([k]) => k === choice);
  const level = formData.get("level") === "edit" ? "edit" : "view";
  const until = choice === "off" || !length ? null : new Date(Date.now() + length[2] * 3600 * 1000).toISOString();
  const { error } = await supabase
    .from("support_access")
    .upsert({ stylist_id: user.id, until, level, updated_at: new Date().toISOString() }, { onConflict: "stylist_id" });
  if (error) return { error: "Couldn't save. Please try again." };
  // On the pro's Activity page too (written by the server; not emailed).
  await createAdminClient()
    .from("support_log")
    .insert({
      stylist_id: user.id,
      actor: "You",
      action: until ? `Turned on support access (${level === "edit" ? "view and edit" : "view only"}, ${length[1]})` : "Turned off support access",
      level: "owner",
    });
  revalidatePath("/dashboard/settings/support");
  revalidatePath("/dashboard/activity");
  return { success: until ? "Support access is on." : "Support access is off." };
}

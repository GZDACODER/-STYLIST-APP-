"use server";

// The pro's side of the client features (step 46 SQL): perks, aftercare
// tips, "My look" (a style photo and notes shared with the client), and
// clearing running-late notices. The database's rules only let a pro change
// their own rows.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Settings → Regulars: perks shown to clients, and the birthday treat.
export async function savePerks(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  const regular = String(formData.get("regular_perks") || "").trim().slice(0, 300);
  const birthday = String(formData.get("birthday_perk") || "").trim().slice(0, 300);
  const { error } = await supabase.from("stylists").update({ regular_perks: regular, birthday_perk: birthday }).eq("id", user.id);
  if (error) return { error: "Couldn't save. Run supabase/migrations/0051_client_home.sql if you haven't." };
  revalidatePath("/dashboard/settings/regulars");
  return { success: "Saved." };
}

// Services: aftercare tips emailed after each visit for that service.
export async function saveAftercare(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  const id = String(formData.get("id") || "");
  const text = String(formData.get("aftercare") || "").trim().slice(0, 2000);
  const { error } = await supabase.from("services").update({ aftercare: text }).eq("id", id).eq("stylist_id", user.id);
  if (error) return { error: "Couldn't save. Run supabase/migrations/0051_client_home.sql if you haven't." };
  revalidatePath("/dashboard/services");
  return { success: text ? "Saved. It's emailed after each visit for this service." : "Removed." };
}

// Wrap up: the style photo (already uploaded to the private client-looks
// bucket, in the pro's own folder) and notes to share with the client.
export async function saveLook({ bookingId, photoPath, note, removePhoto = false }) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (photoPath && !String(photoPath).startsWith(`${user.id}/`)) return { error: "That photo didn't upload." };
  const update = { shared_note: String(note || "").trim().slice(0, 1000) || null };
  if (photoPath) update.look_photo_path = photoPath;
  if (removePhoto) update.look_photo_path = null;
  const { data: old } = await supabase.from("bookings").select("look_photo_path").eq("id", bookingId).maybeSingle();
  const { error } = await supabase.from("bookings").update(update).eq("id", bookingId).eq("stylist_id", user.id);
  if (error) return { error: "Couldn't save. Run supabase/migrations/0051_client_home.sql if you haven't." };
  // The old photo goes when it's replaced or removed.
  if (old?.look_photo_path && (removePhoto || photoPath) && old.look_photo_path !== photoPath) {
    await supabase.storage.from("client-looks").remove([old.look_photo_path]);
  }
  revalidatePath("/dashboard/wrapup");
  return { success: "Shared with the client." };
}

export async function dismissLate(id) {
  const { supabase, user } = await me();
  if (!user) return;
  await supabase.from("late_notices").update({ seen_at: new Date().toISOString() }).eq("id", String(id));
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/today");
}

// A one-time upload link for a look photo, in the pro's own folder.
export async function startLookUpload(bookingId) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  const path = `${user.id}/${String(bookingId).replace(/[^0-9a-f-]/gi, "")}-${Date.now()}.jpg`;
  const { data, error } = await supabase.storage.from("client-looks").createSignedUploadUrl(path);
  if (error) return { error: "Photos aren't set up yet. Run supabase/migrations/0051_client_home.sql." };
  return { path: data.path, token: data.token };
}

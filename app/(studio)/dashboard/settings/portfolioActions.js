"use server";

// Portfolio photos (Settings -> Your business). Like the cover photo: the
// browser shrinks a photo, asks here for a one-time upload link, sends the
// photo straight to Storage ("portfolio" bucket, the business's own folder),
// then asks here to save it. See 0031_portfolio.sql.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PORTFOLIO_MAX = 12;
const FILE = /^p-\d{10,16}-[a-z0-9]{6}\.jpg$/;

const SETUP = "Portfolio photos aren't set up yet: run supabase/migrations/0031_portfolio.sql in Supabase, then try again.";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function refresh() {
  revalidatePath("/dashboard/settings", "layout");
  revalidatePath("/book", "layout");
}

function setupError(error) {
  const text = String(error?.message || "");
  return error?.code === "42P01" || error?.code === "PGRST205" || /portfolio_photos|bucket not found/i.test(text);
}

// Step 1: a one-time upload link into the business's own folder.
export async function startPortfolioUpload() {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };

  const { count, error: countError } = await supabase
    .from("portfolio_photos")
    .select("id", { count: "exact", head: true });
  if (countError) return { error: setupError(countError) ? SETUP : countError.message };
  if ((count || 0) >= PORTFOLIO_MAX) return { error: `You can show up to ${PORTFOLIO_MAX} photos. Remove one to add another.` };

  const random = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
  const path = `${user.id}/p-${Date.now()}-${random}.jpg`;
  const { data, error } = await supabase.storage.from("portfolio").createSignedUploadUrl(path);
  if (error) {
    console.error("Couldn't start portfolio upload", error);
    if (setupError(error) || /row-level security|policy|unauthorized|403/i.test(error.message)) return { error: SETUP };
    return { error: `The photo couldn't be uploaded: ${error.message}` };
  }
  return { path: data.path, token: data.token };
}

// Step 2: after the browser has uploaded the photo, add it to the end.
export async function addPortfolioPhoto(path) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };

  const filePath = String(path || "");
  const [folder, fileName, ...rest] = filePath.split("/");
  if (folder !== user.id || rest.length || !FILE.test(fileName || "")) {
    return { error: "That photo didn't upload properly. Please try again." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("portfolio").getPublicUrl(filePath);

  const { data: last } = await supabase
    .from("portfolio_photos")
    .select("position")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("portfolio_photos").insert({
    stylist_id: user.id,
    path: filePath,
    url: publicUrl,
    position: (last?.position ?? -1) + 1,
  });
  if (error) {
    await supabase.storage.from("portfolio").remove([filePath]);
    if (String(error.message).includes("portfolio_full")) {
      return { error: `You can show up to ${PORTFOLIO_MAX} photos. Remove one to add another.` };
    }
    console.error("Couldn't save portfolio photo", error);
    return { error: setupError(error) ? SETUP : error.message };
  }

  refresh();
  return { success: true };
}

export async function savePortfolioCaption(id, caption) {
  const text = String(caption || "").trim();
  if (text.length > 120) return { error: "Please keep captions under 120 characters." };
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };

  const { error } = await supabase.from("portfolio_photos").update({ caption: text }).eq("id", String(id));
  if (error) return { error: error.message };
  refresh();
  return { success: "Saved." };
}

// direction: -1 (earlier) or 1 (later). Swaps with the neighbour.
export async function movePortfolioPhoto(id, direction) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };

  const { data: photos, error } = await supabase
    .from("portfolio_photos")
    .select("id, position")
    .order("position")
    .order("created_at");
  if (error) return { error: error.message };

  const list = photos || [];
  const i = list.findIndex((p) => p.id === String(id));
  const j = i + (direction < 0 ? -1 : 1);
  if (i < 0 || j < 0 || j >= list.length) return { success: true };

  // Renumber everyone 0..n so positions stay unique, with the two swapped.
  [list[i], list[j]] = [list[j], list[i]];
  const results = await Promise.all(
    list.map((p, index) =>
      p.position === index ? null : supabase.from("portfolio_photos").update({ position: index }).eq("id", p.id)
    )
  );
  const failed = results.find((r) => r?.error);
  if (failed) return { error: failed.error.message };

  refresh();
  return { success: true };
}

export async function removePortfolioPhoto(id) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };

  const { data: photo } = await supabase
    .from("portfolio_photos")
    .select("id, path")
    .eq("id", String(id))
    .maybeSingle();
  if (!photo) return { success: true };

  const { error } = await supabase.from("portfolio_photos").delete().eq("id", photo.id);
  if (error) return { error: error.message };
  const { error: fileError } = await supabase.storage.from("portfolio").remove([photo.path]);
  if (fileError) console.error("Couldn't delete portfolio file", fileError);

  refresh();
  return { success: true };
}

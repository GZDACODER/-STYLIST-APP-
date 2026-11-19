"use server";

// First-visit tips for pros: saving which guides they've seen (step 44 SQL),
// and "Show tips again". The list is read in the dashboard layout.
import { createClient } from "@/lib/supabase/server";
import { isGuideKey } from "@/lib/guides";

export async function markGuideSeen(keys) {
  const list = (Array.isArray(keys) ? keys : [keys]).filter(isGuideKey).slice(0, 40);
  if (!list.length) return { ok: false };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from("onboarding_guides_seen")
    .upsert(list.map((guide_key) => ({ user_id: user.id, guide_key })), { onConflict: "user_id,guide_key", ignoreDuplicates: true });
  return { ok: !error };
}

export async function resetGuides() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const { error } = await supabase.from("onboarding_guides_seen").delete().eq("user_id", user.id);
  return { ok: !error };
}

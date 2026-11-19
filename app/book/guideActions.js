"use server";

// First-visit tips for clients on booking pages. A client who hasn't
// confirmed their email yet has no login, so their "seen" list lives only on
// their phone until they do; after that it's saved here too (step 44 SQL).
import { createBookingClient } from "@/lib/supabase/booking";
import { isGuideKey } from "@/lib/guides";

export async function clientSeenGuides() {
  const supabase = await createBookingClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { signedIn: false, keys: [] };
  const { data, error } = await supabase.from("onboarding_guides_seen").select("guide_key");
  return { signedIn: true, keys: error ? [] : (data || []).map((r) => r.guide_key) };
}

export async function markClientGuideSeen(keys) {
  const list = (Array.isArray(keys) ? keys : [keys]).filter(isGuideKey).slice(0, 40);
  if (!list.length) return { ok: false };
  const supabase = await createBookingClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, signedIn: false };
  const { error } = await supabase
    .from("onboarding_guides_seen")
    .upsert(list.map((guide_key) => ({ user_id: user.id, guide_key })), { onConflict: "user_id,guide_key", ignoreDuplicates: true });
  return { ok: !error, signedIn: true };
}

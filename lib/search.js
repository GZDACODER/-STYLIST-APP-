// Find a pro (/find, step 59 SQL). Server only.
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_SHOW, nextOpenings, typeLabel } from "@/lib/publicProfile";

export const SEARCH_TYPES = [
  ["", "Any type"],
  ["hair", "Hair stylist"],
  ["barber", "Barber"],
  ["tattoo", "Tattoo artist"],
  ["tutor", "Tutor"],
  ["nails", "Nail tech"],
  ["lashes", "Lash artist"],
];

export async function searchCities() {
  const { data } = await createAdminClient().rpc("search_cities");
  return (data || []).map((r) => r.city);
}

/** Returns { results, limited } */
export async function searchPros({ q, type, city }) {
  const admin = createAdminClient();
  // Searches are limited per address so nobody can copy the whole list.
  const h = await headers();
  const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const { data: ok } = await admin.rpc("rate_ok", { p_bucket: `search:${ip}`, p_max: 120, p_window: "1 hour" });
  if (ok === false) return { results: [], limited: true };

  const { data: rows, error } = await admin.rpc("search_pros", {
    p_q: String(q || "").slice(0, 80),
    p_type: SEARCH_TYPES.some(([k]) => k === type) ? type || null : null,
    p_city: String(city || "").slice(0, 80) || null,
    p_limit: 20,
  });
  if (error || !rows?.length) return { results: [], limited: false, error: Boolean(error) };

  const { data: svcRows } = await admin
    .from("services")
    .select("id, stylist_id, duration_minutes")
    .in("stylist_id", rows.map((r) => r.id));
  const servicesOf = {};
  for (const s of svcRows || []) (servicesOf[s.stylist_id] ||= []).push(s);

  const results = await Promise.all(
    rows.map(async (r) => {
      const show = { ...DEFAULT_SHOW, ...(r.profile_show || {}) };
      let next = null;
      if (show.openings && !r.regulars_only) {
        try {
          next = (await nextOpenings(r.slug, servicesOf[r.id], 1))[0] || null;
        } catch {
          next = null;
        }
      }
      return {
        handle: r.handle,
        name: r.business_name,
        owner: r.owner_name || "",
        type: typeLabel(r.business_type),
        city: r.city || "",
        photo: /^https:\/\//.test(r.cover_photo_url || "") ? r.cover_photo_url : null,
        rating: show.reviews && r.ratings ? { average: Number(r.rating), count: r.ratings } : null,
        regularsOnly: r.regulars_only,
        next,
      };
    })
  );
  return { results, limited: false };
}

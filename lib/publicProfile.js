// Public pro profiles (clientelesuite.com/p/<handle>, step 57 SQL). Server
// only: the profile is read with the secret key, and only shown when the pro
// has switched it on (or to the pro themself, as a preview).
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBookingClient } from "@/lib/supabase/booking";
import { templateFor, swapWords } from "@/lib/templates";
import { instagramUrl } from "@/lib/profileLinks";

import { DEFAULT_SHOW, HANDLE_RE, tiktokUrl, websiteUrl } from "@/lib/profileShared";
export * from "@/lib/profileShared";

// What kind of business, in plain words, for the profile and search.
const TYPE_LABELS = { hair: "Hair stylist", nails: "Nail tech", lashes: "Lash artist", barber: "Barber", tattoo: "Tattoo artist", tutor: "Tutor" };
export function typeLabel(businessType) {
  return TYPE_LABELS[businessType] || templateFor(businessType).label || "Beauty pro";
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const clock = (t) => {
  const [h, m] = String(t).split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, "0")} ${ap}` : `${hh} ${ap}`;
};

/**
 * The profile for /p/<handle>. viewerId: the logged-in user, so a pro can
 * preview their own profile before switching it on. Returns null if there's
 * no profile to show.
 */
export const loadProfile = cache(async (handle, viewerId = null) => {
  const h = String(handle || "").toLowerCase();
  if (!HANDLE_RE.test(h)) return null;
  const admin = createAdminClient();
  const { data: s } = await admin
    .from("stylists")
    .select(
      "id, slug, handle, business_name, first_name, owner_name, business_type, modules, city, bio, specialties, years_in_business, instagram, tiktok, website, cover_photo_url, tagline, timezone, cancellation_policy, deposits_enabled, regulars_only, waitlist_enabled, profile_on, profile_show"
    )
    .eq("handle", h)
    .maybeSingle();
  if (!s) return null;
  const preview = !s.profile_on && viewerId && viewerId === s.id;
  if (!s.profile_on && !preview) return null;
  const show = { ...DEFAULT_SHOW, ...(s.profile_show || {}) };
  const t = templateFor(s.business_type, s.modules);

  const booking = await createBookingClient();
  const [{ data: page }, { data: hours }, portfolio] = await Promise.all([
    booking.rpc("get_booking_page", { p_slug: s.slug }),
    show.hours ? admin.from("working_hours").select("weekday, is_working, start_time, end_time").eq("stylist_id", s.id).order("weekday") : { data: [] },
    show.portfolio
      ? booking.rpc("get_portfolio", { p_slug: s.slug }).then(
          (r) => (r.data || []).filter((p) => /^https:\/\//.test(p.url || "")),
          () => []
        )
      : [],
  ]);
  const services = page?.services || [];

  // The next few open times anyone can book (not regulars-only ones), for
  // the shortest service so the most times show.
  let openings = [];
  if (show.openings && services.length && !s.regulars_only) {
    const shortest = [...services].sort((a, b) => a.duration_minutes - b.duration_minutes)[0];
    const { data: slots } = await booking.rpc("get_open_slots", { p_slug: s.slug, p_service_id: shortest.id });
    const seen = new Set();
    for (const sl of slots || []) {
      if (sl.visibility !== "everyone") continue;
      // At most two times a day, so the list covers a few days.
      const n = [...seen].filter((k) => k.startsWith(sl.slot_date)).length;
      if (n >= 2) continue;
      seen.add(`${sl.slot_date} ${sl.slot_time}`);
      openings.push({ date: sl.slot_date, time: sl.slot_time.slice(0, 5), label: clock(sl.slot_time) });
      if (openings.length >= 6) break;
    }
  }

  const deposits = services.filter((x) => x.deposit_cents > 0);
  return {
    id: s.id,
    preview,
    slug: s.slug,
    handle: s.handle,
    name: s.business_name,
    owner: s.owner_name || "",
    type: typeLabel(s.business_type),
    city: s.city || "",
    bio: s.bio || s.tagline || "",
    specialties: String(s.specialties || "")
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 12),
    years: s.years_in_business,
    photo: /^https:\/\//.test(s.cover_photo_url || "") ? s.cover_photo_url : null,
    links: {
      instagram: instagramUrl(s.instagram),
      tiktok: tiktokUrl(s.tiktok),
      website: websiteUrl(s.website),
    },
    show,
    words: t.words,
    servicesTitle: swapWords("Services", t.words),
    services: services.map((x) => ({ id: x.id, name: x.name, price_cents: x.price_cents, minutes: x.duration_minutes, deposit_cents: x.deposit_cents })),
    depositNote:
      s.deposits_enabled && deposits.length
        ? `A deposit is taken when you book ${deposits.length === services.length ? "" : "some services "}and counts toward your price.`.replace("  ", " ")
        : "",
    cancellation: String(s.cancellation_policy || "").trim(),
    hours: [...(hours || [])].sort((a, b) => ((a.weekday + 6) % 7) - ((b.weekday + 6) % 7)).map((r) => ({
      day: DAYS[r.weekday] || "",
      open: r.is_working,
      text: r.is_working ? `${clock(r.start_time)} – ${clock(r.end_time)}` : "Closed",
    })),
    portfolio,
    openings,
    regularsOnly: Boolean(s.regulars_only),
    waitlist: Boolean(s.waitlist_enabled),
    timezone: s.timezone,
  };
});

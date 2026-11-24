// Public pro profiles (clientelesuite.com/p/<handle>, step 57 SQL). Server
// only: the profile is read with the secret key, and only shown when the pro
// has switched it on (or to the pro themself, as a preview).
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBookingClient } from "@/lib/supabase/booking";
import { templateFor, swapWords } from "@/lib/templates";
import { instagramUrl } from "@/lib/profileLinks";
import { ratingSummary, reviewerName } from "@/lib/reviews";
import { isDemoSlug } from "@/lib/demo";
import { sample } from "@/lib/examples";

function DEMO_REVIEWS(t) {
  const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
  const svc = (t.presets.services || []).map((x) => x.name);
  const list = sample(t).reviews.map((r, i) => ({
    id: `00000000-0000-4000-8000-00000000000${i + 1}`,
    rating: r.rating,
    comment: r.comment,
    reply: r.reply,
    date: ago([3, 9, 16, 25][i] || 30),
    name: r.name,
    service: svc[i % Math.max(1, svc.length)] || "",
  }));
  const ratings = [5, 5, 4, 5, 5, 5, 4, 5, 5, 3, 5, 5];
  return { ...ratingSummary(ratings), writtenCount: list.length, list };
}

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
 * The next open times anyone can book (not regulars-only ones): the first
 * each day, for the shortest service so the most times show.
 */
export async function nextOpenings(slug, services, max = 6) {
  if (!services?.length) return [];
  const shortest = [...services].sort((a, b) => a.duration_minutes - b.duration_minutes)[0];
  const booking = await createBookingClient();
  const { data: slots } = await booking.rpc("get_open_slots", { p_slug: slug, p_service_id: shortest.id });
  const out = [];
  const seen = new Set();
  for (const sl of slots || []) {
    if (sl.visibility !== "everyone" || seen.has(sl.slot_date)) continue;
    seen.add(sl.slot_date);
    out.push({ date: sl.slot_date, time: sl.slot_time.slice(0, 5), label: clock(sl.slot_time) });
    if (out.length >= max) break;
  }
  return out;
}

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

  // Client "My look" photos the client said yes to and the pro chose to show
  // (step 61 SQL), after the pro's own portfolio photos. Never with a name.
  if (show.portfolio && t.modules.myLook !== false) {
    const { data: looks, error: lookError } = await admin
      .from("bookings")
      .select("look_photo_path, service_name")
      .eq("stylist_id", s.id)
      .eq("look_on_profile", true)
      .eq("look_consent", "yes")
      .not("look_photo_path", "is", null)
      .order("booking_date", { ascending: false })
      .limit(24);
    if (!lookError && looks?.length) {
      const { data: signed } = await admin.storage.from("client-looks").createSignedUrls(looks.map((l) => l.look_photo_path), 3600);
      const urlOf = Object.fromEntries((signed || []).filter((x) => x.signedUrl).map((x) => [x.path, x.signedUrl]));
      for (const l of looks) if (urlOf[l.look_photo_path]) portfolio.push({ url: urlOf[l.look_photo_path], caption: l.service_name });
    }
  }

  const openings = show.openings && !s.regulars_only ? await nextOpenings(s.slug, services, 6) : [];

  // Reviews (step 58 SQL): the rating counts every visible rating; only
  // written reviews the pro approved are shown.
  let reviews = null;
  if (show.reviews) {
    const { data: fb, error: fbError } = await admin
      .from("visit_feedback")
      .select("booking_id, rating, comment, is_public, reply, created_at, booking:bookings(client_name, service_name)")
      .eq("stylist_id", s.id)
      .eq("hidden", false)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (!fbError && fb?.length) {
      const written = fb.filter((r) => r.is_public && r.comment);
      reviews = {
        ...ratingSummary(fb.map((r) => r.rating)),
        writtenCount: written.length,
        list: written.map((r) => ({
          id: r.booking_id,
          rating: r.rating,
          comment: r.comment,
          reply: r.reply,
          date: r.created_at,
          name: reviewerName(r.booking?.client_name),
          service: r.booking?.service_name || "",
        })),
      };
    }
  }

  // The demo has no real visits: sample reviews so people can see how it looks.
  if (show.reviews && !reviews && isDemoSlug(s.slug)) reviews = DEMO_REVIEWS(t);

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
    reviews,
    regularsOnly: Boolean(s.regulars_only),
    waitlist: Boolean(s.waitlist_enabled),
    timezone: s.timezone,
  };
});

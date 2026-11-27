// Launch week data: every pro's facts, stage and next note. Server only.
import { createAdminClient } from "@/lib/supabase/admin";
import { publicSiteUrl } from "@/lib/siteUrl";
import { activation, looksLikeTest, nudge } from "@/lib/activation";

const latest = (a, b) => (!a || (b && b > a) ? b : a);
const earliest = (a, b) => (!a || (b && b < a) ? b : a);

export const siteBase = () =>
  publicSiteUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://www.clientelesuite.com");

export async function loadPros() {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const [stylists, services, openings, bookings, users, nudges] = await Promise.all([
    admin.from("stylists").select("id, slug, business_name, first_name, business_type, created_at").order("created_at", { ascending: false }).limit(1000),
    admin.from("services").select("stylist_id, created_at").limit(10000),
    admin.from("openings").select("stylist_id, created_at").gte("opening_date", today).limit(20000),
    // Bookings clients made themselves (booked_by is their own account).
    admin.from("bookings").select("stylist_id, booked_by, created_at").not("booked_by", "is", null).neq("status", "expired").limit(20000),
    admin.auth.admin.listUsers({ perPage: 1000 }),
    admin.from("admin_nudges").select("stylist_id, stage, sent_at").order("sent_at", { ascending: false }).limit(5000),
  ]);
  const error = stylists.error || services.error || openings.error || bookings.error || users.error;

  const by = {};
  const row = (id) => (by[id] ||= { services: 0, servicesAt: null, openingsAhead: 0, openingsAt: null, clientBookings: 0, firstBookingAt: null });
  for (const s of services.data || []) { const r = row(s.stylist_id); r.services += 1; r.servicesAt = latest(r.servicesAt, s.created_at); }
  for (const o of openings.data || []) { const r = row(o.stylist_id); r.openingsAhead += 1; r.openingsAt = latest(r.openingsAt, o.created_at); }
  for (const b of bookings.data || []) {
    if (b.booked_by === b.stylist_id) continue;
    const r = row(b.stylist_id); r.clientBookings += 1; r.firstBookingAt = earliest(r.firstBookingAt, b.created_at);
  }
  const lastNudge = {};
  for (const n of nudges.data || []) lastNudge[n.stylist_id] ||= n;
  const userById = new Map((users.data?.users || []).map((u) => [u.id, u]));
  const base = siteBase();
  const now = Date.now();

  const pros = (stylists.data || []).map((s) => {
    const u = userById.get(s.id);
    const p = {
      ...row(s.id),
      id: s.id,
      email: u?.email || "",
      lastSignInAt: u?.last_sign_in_at || null,
      firstName: String(s.first_name || "").trim(),
      businessName: s.business_name,
      slug: s.slug,
      trade: s.business_type,
      createdAt: s.created_at,
    };
    const a = activation(p, now);
    const note = nudge(p, a.stage, base);
    return { ...p, ...a, note, nudged: lastNudge[s.id] || null, test: looksLikeTest(p), mailto: `mailto:${p.email}?subject=${encodeURIComponent(note.subject)}&body=${encodeURIComponent(note.body)}` };
  });
  return { pros, error };
}

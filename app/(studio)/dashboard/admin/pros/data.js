// The Pros pages' data: every pro (Launch week's facts and setup stage) plus
// their plan, Stripe payouts and whether they're a founding pro. Server only.
import { createAdminClient } from "@/lib/supabase/admin";
import { adminEmails, isOwnerAlias } from "@/lib/admin";
import { planStatus } from "@/lib/adminPlan";
import { loadPros } from "../launch/data";

export async function loadProsAdmin() {
  const admin = createAdminClient();
  const [{ pros, error }, plans, stylists, founding] = await Promise.all([
    loadPros(),
    admin.from("stylist_plans").select("stylist_id, comped, trial_ends_at, base_active, regulars_active, waitlist_active, billing_interval, stripe_status, current_period_end, cancel_at_period_end").limit(5000),
    admin.from("stylists").select("id, stripe_account_id, stripe_charges_enabled").limit(5000),
    admin.from("admin_actions").select("stylist_id").eq("action", "founding").limit(5000),
  ]);
  const planOf = new Map((plans.data || []).map((p) => [p.stylist_id, p]));
  const payOf = new Map((stylists.data || []).map((s) => [s.id, s]));
  const foundingIds = new Set((founding.data || []).map((a) => a.stylist_id));
  const owners = new Set(adminEmails());
  const now = Date.now();
  const list = pros.map((p) => {
    const plan = planOf.get(p.id) || null;
    const pay = payOf.get(p.id) || {};
    const isFounding = foundingIds.has(p.id);
    const you = owners.has(String(p.email).toLowerCase()) || isOwnerAlias(p.email);
    return {
      ...p,
      you,
      test: p.test || you,
      plan,
      founding: isFounding,
      status: planStatus(plan, now, { founding: isFounding }),
      payouts: pay.stripe_charges_enabled ? "on" : pay.stripe_account_id ? "started" : "off",
    };
  });
  return { pros: list, error: error || plans.error || stylists.error };
}

export async function loadProAdmin(id) {
  const { pros, error } = await loadProsAdmin();
  const p = pros.find((x) => x.id === id);
  if (!p) return { pro: null, error };
  const admin = createAdminClient();
  const [log, nudges, bookings] = await Promise.all([
    admin.from("admin_actions").select("action, detail, admin_email, created_at").eq("stylist_id", id).order("created_at", { ascending: false }).limit(50),
    admin.from("admin_nudges").select("subject, sent_at").eq("stylist_id", id).order("sent_at", { ascending: false }).limit(20),
    admin.from("bookings").select("status, deposit_status, deposit_cents, booking_date").eq("stylist_id", id).limit(5000),
  ]);
  const b = bookings.data || [];
  const today = new Date().toISOString().slice(0, 10);
  const stats = {
    total: b.filter((x) => x.status !== "expired").length,
    upcoming: b.filter((x) => x.status === "confirmed" && x.booking_date >= today).length,
    cancelled: b.filter((x) => x.status === "cancelled").length,
    depositsCents: b.filter((x) => x.deposit_status === "paid").reduce((s, x) => s + (x.deposit_cents || 0), 0),
  };
  return { pro: { ...p, log: log.data || [], nudges: nudges.data || [], stats }, error };
}

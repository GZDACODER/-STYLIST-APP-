// Shop accounts on the server (0081 SQL, lib/shops.js): who's in which
// shop, joining and leaving, and keeping the owner's bill in step with the
// chairs (lib/billing.js setShopChairs). Server only; writes use the admin
// client after the caller's checks.
import { createAdminClient } from "@/lib/supabase/admin";
import { setShopChairs } from "@/lib/billing";
import { getStripe } from "@/lib/stripe";
import { stylistEmails } from "@/lib/waitlist";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { publicSiteUrl } from "@/lib/siteUrl";
import { INVITE_TOKEN, joinProblem } from "@/lib/shops";

// { owns: shop | null, chairIn: { shop, chair } | null } for one pro.
export async function shopRoles(stylistId) {
  const admin = createAdminClient();
  const [{ data: owns }, { data: chair }] = await Promise.all([
    admin.from("shops").select("id, name, owner_id").eq("owner_id", stylistId).maybeSingle(),
    admin
      .from("shop_chairs")
      .select("id, joined_at, shop:shops(id, name, owner_id, owner:stylists(business_name))")
      .eq("stylist_id", stylistId)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  return { owns: owns || null, chairIn: chair?.shop ? { shop: chair.shop, chair } : null };
}

// Other chairs in the owner's shop right now.
export async function extraChairCount(ownerId) {
  const admin = createAdminClient();
  const { data: shop } = await admin.from("shops").select("id").eq("owner_id", ownerId).maybeSingle();
  if (!shop) return 0;
  const { count } = await admin
    .from("shop_chairs")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shop.id)
    .eq("status", "active")
    .neq("stylist_id", ownerId);
  return count || 0;
}

// The owner's subscription pays for exactly the chairs in the shop. Never
// stops a join or leave: a Stripe problem is logged and fixed next change.
export async function syncShopBilling(ownerId) {
  try {
    return await setShopChairs(ownerId, await extraChairCount(ownerId));
  } catch (error) {
    console.error("Couldn't update the shop's chairs on Stripe", ownerId, error?.message);
    return null;
  }
}

// An invite by its link, with its shop and owner. null if there's none.
export async function loadInvite(token) {
  if (!INVITE_TOKEN.test(String(token || ""))) return null;
  const { data } = await createAdminClient()
    .from("shop_chairs")
    .select("id, shop_id, stylist_id, status, invite_name, invite_email, shop:shops(id, name, owner_id, owner:stylists(business_name, first_name))")
    .eq("invite_token", token)
    .maybeSingle();
  return data || null;
}

// Invites waiting for this email (shown as a banner in the dashboard).
export async function invitesForEmail(email) {
  const clean = String(email || "").trim().toLowerCase();
  if (!clean) return [];
  const { data } = await createAdminClient()
    .from("shop_chairs")
    .select("invite_token, shop:shops(name)")
    .eq("status", "invited")
    .ilike("invite_email", clean)
    .limit(3);
  return data || [];
}

/**
 * The logged-in pro takes the chair. Their own Clientele subscription (if
 * any) is set to end at the end of its period, since the shop pays now.
 * Returns { joined: shopName, endedOwnPlan } or { error }.
 */
export async function joinShop(token, stylistId) {
  const invite = await loadInvite(token);
  const roles = await shopRoles(stylistId);
  const problem = joinProblem(
    { id: stylistId, ownsShopId: roles.owns?.id || null, chairShopId: roles.chairIn?.shop.id || null },
    invite ? { ...invite, owner_id: invite.shop?.owner_id } : null
  );
  if (problem) return { error: problem };

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("shop_chairs")
    .update({ status: "active", stylist_id: stylistId, joined_at: new Date().toISOString() })
    .eq("id", invite.id)
    .eq("status", "invited")
    .select("id");
  if (error) {
    if (/shop_chairs_one_shop|duplicate/i.test(error.message)) return { error: "You're already a chair in a shop." };
    throw error;
  }
  if (!rows?.length) return { error: "This invite was already used." };

  // Their own plan stops renewing: the shop pays from now on.
  let endedOwnPlan = false;
  const { data: own } = await admin.from("stylist_plans").select("stripe_subscription_id, stripe_status").eq("stylist_id", stylistId).maybeSingle();
  if (own?.stripe_subscription_id && ["active", "trialing", "past_due"].includes(own.stripe_status)) {
    try {
      await getStripe().subscriptions.update(own.stripe_subscription_id, { cancel_at_period_end: true });
      endedOwnPlan = true;
    } catch (e) {
      console.error("Couldn't stop the new chair's own plan", stylistId, e?.message);
    }
  }

  await syncShopBilling(invite.shop.owner_id);
  await tellOwner(invite.shop, stylistId, "joined");
  return { joined: invite.shop.name, endedOwnPlan };
}

// The owner removes a chair, or a chair leaves. Their account, page,
// clients and bookings stay theirs; their plan is their own again.
export async function endChair(chairId, { ownerId = null, stylistId = null }) {
  const admin = createAdminClient();
  const { data: chair } = await admin
    .from("shop_chairs")
    .select("id, stylist_id, status, shop:shops(id, name, owner_id)")
    .eq("id", chairId)
    .maybeSingle();
  if (!chair || chair.status === "removed") return { error: "That chair isn't in the shop." };
  if (ownerId && chair.shop?.owner_id !== ownerId) return { error: "That chair isn't in your shop." };
  if (stylistId && chair.stylist_id !== stylistId) return { error: "That isn't your chair." };
  const wasActive = chair.status === "active";
  await admin.from("shop_chairs").update({ status: "removed", removed_at: new Date().toISOString() }).eq("id", chair.id);
  if (wasActive) {
    await syncShopBilling(chair.shop.owner_id);
    if (stylistId) await tellOwner(chair.shop, stylistId, "left");
  }
  return { ok: true, wasActive };
}

async function tellOwner(shop, stylistId, what) {
  if (!emailConfigured()) return;
  try {
    const admin = createAdminClient();
    const [{ data: pro }, emails] = await Promise.all([
      admin.from("stylists").select("business_name").eq("id", stylistId).maybeSingle(),
      stylistEmails(admin, [shop.owner_id]),
    ]);
    const to = emails[shop.owner_id];
    if (!to) return;
    const site = publicSiteUrl("https://www.clientelesuite.com");
    const name = pro?.business_name || "A chair";
    const line =
      what === "joined"
        ? `${name} joined ${shop.name}. Their chair is on your plan from today.`
        : `${name} left ${shop.name}. Their chair is off your plan from today.`;
    await sendEmails([
      {
        to,
        subject: what === "joined" ? `${name} joined your shop` : `${name} left your shop`,
        html: emailLayout(what === "joined" ? "A chair joined" : "A chair left", [
          `<p>${escapeHtml(line)}</p>`,
          `<p>${emailButton(`${site}/dashboard/shop`, "Open your shop")}</p>`,
        ]),
        text: `${line} ${site}/dashboard/shop`,
      },
    ]);
  } catch {
    // Only a heads-up.
  }
}

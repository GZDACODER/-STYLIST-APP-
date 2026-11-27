"use server";

// Shop accounts (0081 SQL, lib/shopsServer.js): start a shop, add a chair
// (email invite), cancel an invite, remove a chair, leave a shop, join.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";
import { blockedInHelpMode } from "@/lib/helpModeServer";
import { checkInvite, checkShopName, MAX_EXTRA_CHAIRS, newInviteToken } from "@/lib/shops";
import { endChair, joinShop, shopRoles } from "@/lib/shopsServer";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { publicSiteUrl } from "@/lib/siteUrl";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  const block = await blockedInHelpMode();
  if (block) return block;
  return { user };
}

const site = () => publicSiteUrl("https://www.clientelesuite.com");
export async function inviteUrl(token) {
  return `${site()}/join/shop/${token}`;
}

export async function startShop(prev, formData) {
  const { user, error } = await me();
  if (error) return { error };
  const checked = checkShopName(formData.get("name"));
  if (checked.error) return checked;
  const roles = await shopRoles(user.id);
  if (roles.owns) return { error: "You already have a shop." };
  if (roles.chairIn) return { error: `You're a chair in ${roles.chairIn.shop.name}. Leave it first to start your own shop.` };
  const { error: e } = await createAdminClient().from("shops").insert({ owner_id: user.id, name: checked.name });
  if (e) return { error: "Couldn't start the shop. Please try again." };
  revalidatePath("/dashboard/shop");
  return { success: "Your shop is ready. Add your first chair below." };
}

export async function addChair(prev, formData) {
  const { user, error } = await me();
  if (error) return { error };
  const checked = checkInvite({ name: formData.get("name"), email: formData.get("email") });
  if (checked.error) return checked;
  if (checked.email === String(user.email || "").toLowerCase()) return { error: "That's your own email. Your chair is already in the shop." };
  const roles = await shopRoles(user.id);
  if (!roles.owns) return { error: "Start your shop first." };

  const admin = createAdminClient();
  const { data: open } = await admin.from("shop_chairs").select("id, status, invite_email").eq("shop_id", roles.owns.id).in("status", ["invited", "active"]);
  if ((open || []).length >= MAX_EXTRA_CHAIRS) return { error: `A shop can have up to ${MAX_EXTRA_CHAIRS} other chairs. Email us if you need more.` };
  if ((open || []).some((c) => c.status === "invited" && c.invite_email === checked.email)) {
    return { error: "There's already an invite for that email. Copy its link below, or cancel it and add them again." };
  }

  const token = newInviteToken();
  const { error: e } = await admin.from("shop_chairs").insert({
    shop_id: roles.owns.id,
    invite_name: checked.name || null,
    invite_email: checked.email,
    invite_token: token,
  });
  if (e) return { error: "Couldn't add the chair. Please try again." };

  const link = await inviteUrl(token);
  let emailed = false;
  if (emailConfigured()) {
    const hi = checked.name ? `Hi ${escapeHtml(checked.name.split(" ")[0])},` : "Hi,";
    const shop = roles.owns.name;
    const result = await sendEmails([
      {
        to: checked.email,
        subject: `Join ${shop} on Clientele`,
        html: emailLayout(`Join ${shop}`, [
          `<p>${hi}</p>`,
          `<p>${escapeHtml(shop)} added you as a chair on Clientele. You get your own booking page, calendar and clients, and card payments go straight to your own Stripe account. The shop pays for your plan.</p>`,
          `<p>${emailButton(link, "Join the shop")}</p>`,
          `<p style="color:#6b665c;font-size:13px;">New to Clientele? Sign up with this email (${escapeHtml(checked.email)}), then open the link again.</p>`,
        ]),
        text: `${shop} added you as a chair on Clientele: your own booking page, calendar and payouts, and the shop pays for your plan. Join: ${link}\nNew to Clientele? Sign up with this email, then open the link again.`,
      },
    ]).catch(() => null);
    emailed = result !== null;
  }
  revalidatePath("/dashboard/shop");
  return {
    success: emailed ? `Invite emailed to ${checked.email}. You can also send them the link.` : `Chair added. Send ${checked.email} the link to join.`,
    link,
  };
}

export async function cancelInvite(formData) {
  const { user, error } = await me();
  if (error) return;
  await endChair(String(formData.get("id") || ""), { ownerId: user.id });
  revalidatePath("/dashboard/shop");
}

export async function removeChair(formData) {
  const { user, error } = await me();
  if (error) return;
  await endChair(String(formData.get("id") || ""), { ownerId: user.id });
  revalidatePath("/dashboard/shop");
  revalidatePath("/dashboard/settings", "layout");
}

export async function leaveShop(formData) {
  const { user, error } = await me();
  if (error) return;
  await endChair(String(formData.get("id") || ""), { stylistId: user.id });
  revalidatePath("/dashboard", "layout");
}

export async function renameShop(prev, formData) {
  const { user, error } = await me();
  if (error) return { error };
  const checked = checkShopName(formData.get("name"));
  if (checked.error) return checked;
  const { error: e } = await createAdminClient().from("shops").update({ name: checked.name }).eq("owner_id", user.id);
  if (e) return { error: "Couldn't rename the shop." };
  revalidatePath("/dashboard/shop");
  return { success: "Saved." };
}

// From the join page or the dashboard banner.
export async function joinShopAction(prev, formData) {
  const { user, error } = await me();
  if (error) return { error };
  const result = await joinShop(String(formData.get("token") || ""), user.id);
  if (result.error) return result;
  revalidatePath("/dashboard", "layout");
  return {
    success: `You joined ${result.joined}. Your plan is on the shop from today.${
      result.endedOwnPlan ? " Your own Clientele plan won't renew, so you're not billed twice." : ""
    }`,
    joined: true,
  };
}

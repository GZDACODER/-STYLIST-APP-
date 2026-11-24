"use server";

// Settings > Public profile > Client photos (step 61 SQL): ask a client if
// their "My look" photo may go on the public profile, and choose which
// consented photos show.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { publicSiteUrl } from "@/lib/siteUrl";

async function me() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function askLookConsent(prev, formData) {
  const { supabase, user } = await me();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };
  // Row security: only the pro's own booking comes back.
  const { data: b } = await supabase
    .from("bookings")
    .select("id, client_name, client_email, service_name, cancel_token, look_photo_path, look_consent, look_consent_asked_at")
    .eq("id", String(formData.get("id")))
    .maybeSingle();
  if (!b?.look_photo_path) return { error: "That photo isn't there any more." };
  if (b.look_consent) return { error: "They've already answered." };
  if (!b.client_email) return { error: "There's no email for this client." };
  if (b.look_consent_asked_at && Date.now() - new Date(b.look_consent_asked_at).getTime() < 3 * 86400000)
    return { error: "You asked recently. You can ask again in a few days." };
  const { data: s } = await supabase.from("stylists").select("business_name").eq("id", user.id).maybeSingle();
  const link = `${publicSiteUrl("https://www.clientelesuite.com")}/v/${b.cancel_token}/look`;
  if (!emailConfigured()) return { error: "Email isn't set up yet." };
  await sendEmails([
    {
      to: b.client_email,
      subject: `Can ${s.business_name} share your look?`,
      html: emailLayout("Can I share your look?", [
        `<p>Hi ${escapeHtml(String(b.client_name || "").split(" ")[0])},</p>`,
        `<p>${escapeHtml(s.business_name)} would love to show the photo of your ${escapeHtml(b.service_name)} on their public profile. Your name is never shown with it, and you can change your mind any time.</p>`,
        `<p>${emailButton(link, "See the photo and answer")}</p>`,
      ]),
      text: `${s.business_name} would love to show the photo of your ${b.service_name} on their public profile. Your name is never shown with it. See the photo and answer: ${link}`,
    },
  ]).catch(() => {});
  await createAdminClient().from("bookings").update({ look_consent_asked_at: new Date().toISOString() }).eq("id", b.id);
  revalidatePath("/dashboard/settings/profile");
  return { success: `Asked. ${b.client_name} has been emailed.` };
}

export async function setLookOnProfile(formData) {
  const { supabase, user } = await me();
  if (!user || isDemo(user)) return;
  // The database refuses this unless the client said yes.
  await supabase.from("bookings").update({ look_on_profile: formData.get("on") === "true" }).eq("id", String(formData.get("id"))).eq("stylist_id", user.id);
  const { data: s } = await supabase.from("stylists").select("handle").eq("id", user.id).maybeSingle();
  if (s?.handle) revalidatePath(`/p/${s.handle}`);
  revalidatePath("/dashboard/settings/profile");
}

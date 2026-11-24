"use server";

// "I'm running late" from a "Manage my appointment" link (no sign-in).
import { createAdminClient } from "@/lib/supabase/admin";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { stylistEmails } from "@/lib/waitlist";
import { clockTime } from "@/lib/availability";
import { publicSiteUrl } from "@/lib/siteUrl";
import { TOKEN_RE } from "@/lib/manageLink";
import { revalidatePath } from "next/cache";

export async function runningLateByLink(token, minutes) {
  if (!TOKEN_RE.test(String(token))) return { error: "This link doesn't work." };
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("visit_running_late", { p_token: String(token), p_minutes: Number(minutes) });
  if (error) {
    if (/too_soon/.test(error.message)) return { error: "They've just been told. You can send another in a few minutes." };
    if (/not_today/.test(error.message)) return { error: "That's only for a visit later today." };
    return { error: "That didn't go through. Please call or message them instead." };
  }
  const row = data?.[0];
  if (row && emailConfigured()) {
    const to = (await stylistEmails(admin, [row.stylist_id], "running_late"))[row.stylist_id];
    if (to) {
      const late = row.minutes >= 15 ? "15+ minutes" : `${row.minutes} minutes`;
      await sendEmails([
        {
          to,
          subject: `${row.client_name} is running ${late} late`,
          html: emailLayout(`${escapeHtml(row.client_name)} is running late`, [
            `<p><strong>${escapeHtml(row.client_name)}</strong> says they're running about <strong>${escapeHtml(late)}</strong> late for their ${escapeHtml(row.service_name)} at ${escapeHtml(clockTime(row.start_time))}.</p>`,
            `<p>${emailButton(`${publicSiteUrl("https://www.clientelesuite.com")}/dashboard/today`, "Open Today")}</p>`,
          ]),
          text: `${row.client_name} is running about ${late} late for their ${row.service_name} at ${clockTime(row.start_time)}.`,
        },
      ]).catch(() => {});
    }
  }
  return { success: true, minutes: row?.minutes };
}

// "My look" on the pro's public profile (step 61 SQL): the client's yes or
// no, from the link in the email asking them.
export async function lookConsentByLink(token, yes) {
  if (!TOKEN_RE.test(String(token))) return { error: "This link doesn't work." };
  const admin = createAdminClient();
  const { data: b } = await admin
    .from("bookings")
    .select("id, look_photo_path, stylist:stylists(handle)")
    .eq("cancel_token", String(token))
    .maybeSingle();
  if (!b?.look_photo_path) return { error: "This photo isn't shared any more." };
  const { error } = await admin
    .from("bookings")
    .update({ look_consent: yes ? "yes" : "no", look_consent_at: new Date().toISOString() })
    .eq("id", b.id);
  if (error) return { error: "That didn't save. Please try again." };
  if (b.stylist?.handle) revalidatePath(`/p/${b.stylist.handle}`);
  return { ok: true, yes: Boolean(yes) };
}

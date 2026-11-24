// Support access (steps 51 and 64 SQL): the pro lets the Clientele team view
// or change their account for a while. Everything done under it is logged
// (support_log, shown on the pro's Activity page) and emailed to the pro.
// Server only.
import { createAdminClient } from "@/lib/supabase/admin";
import { stylistEmails } from "@/lib/waitlist";
import { emailButton, emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { publicSiteUrl } from "@/lib/siteUrl";

export const SUPPORT_LENGTHS = [
  ["1h", "1 hour", 1],
  ["24h", "24 hours", 24],
  ["7d", "7 days", 24 * 7],
];

/** { level: 'view' | 'edit', until } while access is on, else null. */
export async function supportState(stylistId, admin = createAdminClient()) {
  const { data } = await admin.from("support_access").select("level, until").eq("stylist_id", stylistId).maybeSingle();
  return data?.until && new Date(data.until) > new Date() ? { level: data.level || "view", until: data.until } : null;
}

export async function supportAllowed(stylistId, level = "edit") {
  const s = await supportState(stylistId);
  return Boolean(s && (s.level === "edit" || level === "view"));
}

/**
 * Logs one action on the pro's account and emails them. Views are emailed
 * at most once an hour (one "opened your account" per visit, not per page).
 */
export async function logSupport({ stylistId, action, detail = null, level = "edit", actor = "Clientele support" }) {
  const admin = createAdminClient();
  let email = true;
  if (level === "view") {
    const { data: recent } = await admin
      .from("support_log")
      .select("id")
      .eq("stylist_id", stylistId)
      .eq("level", "view")
      .gte("created_at", new Date(Date.now() - 3600000).toISOString())
      .limit(1);
    if (recent?.length) email = false;
  }
  await admin.from("support_log").insert({ stylist_id: stylistId, actor, action: String(action).slice(0, 200), detail: detail ? String(detail).slice(0, 500) : null, level });
  if (!email || !emailConfigured()) return;
  const to = (await stylistEmails(admin, [stylistId]))[stylistId];
  if (!to) return;
  const link = `${publicSiteUrl("https://www.clientelesuite.com")}/dashboard/activity`;
  await sendEmails([
    {
      to,
      subject: level === "view" ? "Clientele support opened your account" : `Clientele support: ${action}`,
      html: emailLayout(level === "view" ? "Support opened your account" : "A change by Clientele support", [
        `<p><strong>${escapeHtml(action)}</strong>${detail ? `<br><span style="color:#6b665c;">${escapeHtml(detail)}</span>` : ""}</p>`,
        `<p style="color:#6b665c;font-size:13px;">This happened because support access is on in your settings. You can see everything on your Activity page, and turn support access off any time.</p>`,
        `<p>${emailButton(link, "See activity")}</p>`,
      ]),
      text: `${action}${detail ? ` (${detail})` : ""}. This happened because support access is on. See everything or turn it off: ${link}`,
    },
  ]).catch(() => {});
}

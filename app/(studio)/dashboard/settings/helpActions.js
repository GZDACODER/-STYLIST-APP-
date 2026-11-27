"use server";

// Help mode, the pro's side: "Let Clientele support help me" opens a 1-hour
// window (help_sessions, 0078 SQL) and emails the owner; "End help now"
// closes it, which also signs support out of the account.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_LOCKED, isDemo } from "@/lib/demo";
import { helpExpiresAt } from "@/lib/helpMode";
import { blockedInHelpMode } from "@/lib/helpModeServer";
import { emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";
import { siteBase } from "../admin/launch/data";

const timeIn = (iso, zone) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: zone || "America/Chicago" });

export async function startHelp() {
  const helpBlock = await blockedInHelpMode();
  if (helpBlock) return helpBlock;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  if (isDemo(user)) return { error: DEMO_LOCKED };

  const nowIso = new Date().toISOString();
  const { data: open } = await supabase
    .from("help_sessions")
    .select("id")
    .is("ended_at", null)
    .gt("expires_at", nowIso)
    .limit(1);
  if (open?.length) return { success: "Help mode is already on." };

  const expires = helpExpiresAt();
  const { error } = await supabase.from("help_sessions").insert({ stylist_id: user.id, expires_at: expires });
  if (error) {
    console.error("Help mode: couldn't start", error.message);
    return { error: "Help mode couldn't start. Please try again." };
  }

  const admin = createAdminClient();
  const { data: me } = await admin.from("stylists").select("business_name, first_name, timezone").eq("id", user.id).maybeSingle();
  await admin.from("support_log").insert({ stylist_id: user.id, actor: "You", action: `Turned on help mode until ${timeIn(expires, me?.timezone)}` });

  // Tell the owner, with a link straight to the request.
  const owners = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim()).filter(Boolean);
  if (owners.length && emailConfigured()) {
    const name = me?.business_name || "A pro";
    const link = `${siteBase()}/dashboard/admin/help`;
    await sendEmails([
      {
        to: owners[0],
        subject: `${name} asked for help`,
        html: emailLayout(`${escapeHtml(name)} asked for help`, [
          `<p>${escapeHtml(me?.first_name || name)} turned on help mode. You can open their account until ${escapeHtml(timeIn(expires, "America/Chicago"))} (Central).</p>`,
          `<p><a href="${link}" style="color:#7d6232;">Open Help requests</a></p>`,
        ]),
        text: `${name} turned on help mode. Open their account until ${timeIn(expires, "America/Chicago")} (Central): ${link}`,
      },
    ]).catch(() => {});
  }
  revalidatePath("/dashboard", "layout");
  return { success: `Help mode is on until ${timeIn(expires, me?.timezone)}.` };
}

export async function endHelp() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };
  const { data: ended } = await supabase
    .from("help_sessions")
    .update({ ended_at: new Date().toISOString(), ended_by: "pro" })
    .is("ended_at", null)
    .eq("stylist_id", user.id)
    .select("id");
  if (ended?.length) {
    await createAdminClient().from("support_log").insert({ stylist_id: user.id, actor: "You", action: "Ended help mode" });
  }
  revalidatePath("/dashboard", "layout");
  return { success: "Help mode is off. Support can't open your account." };
}

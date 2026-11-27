// Finish help mode: closes the help session (if it's still open), emails the
// pro what changed, signs this browser out of the pro's account only, and
// puts the owner back in their own account (enter/route.js kept the way).
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HELP_COOKIE, helpSummary } from "@/lib/helpMode";
import { emailConfigured, emailLayout, escapeHtml, sendEmails } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const jar = await cookies();
  const id = jar.get(HELP_COOKIE)?.value || "";
  const ownerToken = jar.get("cl_admin_return")?.value;
  jar.delete(HELP_COOKIE);
  jar.delete("cl_admin_return");

  let note = url.searchParams.get("reason") === "ended" ? "ended" : "done";
  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const admin = createAdminClient();
    const { data: session } = await admin.from("help_sessions").select("id, stylist_id, entered_at, ended_at, expires_at").eq("id", id).maybeSingle();
    if (session) {
      if (!session.ended_at) {
        const expired = Date.parse(session.expires_at) <= Date.now();
        await admin.from("help_sessions").update({ ended_at: new Date().toISOString(), ended_by: expired ? "expired" : "support" }).eq("id", session.id);
      }
      await admin.from("support_log").insert({ stylist_id: session.stylist_id, actor: "Clientele support", action: "Finished helping (help mode)" });
      // The pro's summary: everything logged since support opened the account.
      const { data: log } = await admin
        .from("support_log")
        .select("action, created_at")
        .eq("stylist_id", session.stylist_id)
        .gte("created_at", session.entered_at || session.expires_at)
        .like("actor", "Clientele support%")
        .order("created_at", { ascending: true })
        .limit(200);
      const lines = helpSummary(log);
      const { data: target } = await admin.auth.admin.getUserById(session.stylist_id);
      const to = target?.user?.email;
      if (to && emailConfigured()) {
        await sendEmails([
          {
            to,
            subject: "Clientele support is done: here's what changed",
            html: emailLayout("Here's what we did on your account", [
              "<p>Clientele support has finished helping and signed out of your account. Here's everything that changed:</p>",
              `<ul>${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`,
              "<p>The same list is in Settings → Support. Reply to this email if anything looks wrong.</p>",
            ]),
            text: `Clientele support has finished helping. What changed:\n${lines.map((l) => `- ${l}`).join("\n")}\n\nThe same list is in Settings → Support.`,
          },
        ]).catch(() => {});
      }
    }
  } else {
    note = "done";
  }

  const supabase = await createClient();
  // Sign out of the pro's account in this browser only (their own devices stay signed in).
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  if (!ownerToken) return NextResponse.redirect(`${origin}/login`);
  const { error } = await supabase.auth.refreshSession({ refresh_token: ownerToken });
  if (error) return NextResponse.redirect(`${origin}/login`);
  return NextResponse.redirect(`${origin}/dashboard/admin/help?note=${note}`);
}

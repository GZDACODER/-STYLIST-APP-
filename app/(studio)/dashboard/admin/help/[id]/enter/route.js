// Admin > Help requests > Open their account: signs the owner's browser into
// the pro's account while their help window is open, keeping the owner's own
// login to come back to (exit/route.js). Owner only (ADMIN_EMAILS), and only
// for a pro who turned on help mode. Logged and emailed to the pro.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/admin";
import { signInAs } from "@/lib/demoAuth";
import { HELP_COOKIE, helpState } from "@/lib/helpMode";
import { emailConfigured, emailLayout, sendEmails } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const origin = new URL(request.url).origin;
  const back = (note) => NextResponse.redirect(`${origin}/dashboard/admin/help?note=${note}`);
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user) || !/^[0-9a-f-]{36}$/i.test(String(id))) return new NextResponse("Not found", { status: 404 });

  const jar = await cookies();
  if (jar.get("cl_admin_return")?.value || jar.get(HELP_COOKIE)?.value) return back("busy");

  const admin = createAdminClient();
  const { data: session } = await admin.from("help_sessions").select("id, stylist_id, expires_at, ended_at, entered_at").eq("id", id).maybeSingle();
  if (helpState(session) !== "open") return back("closed");
  const { data: target } = await admin.auth.admin.getUserById(session.stylist_id);
  const email = target?.user?.email;
  if (!email) return back("failed");

  const {
    data: { session: mine },
  } = await supabase.auth.getSession();
  const ownerToken = mine?.refresh_token;
  if (!ownerToken) return NextResponse.redirect(`${origin}/login`);
  if (!(await signInAs(email))) return back("failed");

  const maxAge = Math.max(60, Math.ceil((Date.parse(session.expires_at) - Date.now()) / 1000) + 300);
  jar.set("cl_admin_return", ownerToken, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 12 * 60 * 60 });
  jar.set(HELP_COOKIE, session.id, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge });

  if (!session.entered_at) await admin.from("help_sessions").update({ entered_at: new Date().toISOString() }).eq("id", session.id);
  await admin.from("support_log").insert({ stylist_id: session.stylist_id, actor: "Clientele support", action: "Opened your account (help mode)" });
  if (emailConfigured()) {
    await sendEmails([
      {
        to: email,
        subject: "Clientele support is helping on your account",
        html: emailLayout("Clientele support is on your account", [
          "<p>You turned on help mode, and Clientele support has opened your dashboard to help.</p>",
          "<p>Every change we make is listed in Settings → Support, and we'll email you a summary when we're done. You can end it any time from the banner at the top of your dashboard.</p>",
        ]),
        text: "Clientele support has opened your dashboard (help mode). Every change is listed in Settings → Support, and you can end it any time from the banner at the top of your dashboard.",
      },
    ]).catch(() => {});
  }
  return NextResponse.redirect(`${origin}/dashboard`);
}

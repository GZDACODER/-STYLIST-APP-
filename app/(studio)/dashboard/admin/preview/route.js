// The owner's "Preview as..." (Control Room): opens a business type's demo
// account (lib/demo.js) in this browser, and keeps a way back to the
// owner's own account (the cl_admin_return cookie) so "Exit preview" needs
// no password. Owner (ADMIN_EMAILS) only.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { signInToDemo } from "@/lib/demoAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user) || !DEMO_ACCOUNTS[type]) return new NextResponse("Not found", { status: 404 });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const back = session?.refresh_token;
  if (!back) return NextResponse.redirect(`${url.origin}/login`);

  if (!(await signInToDemo(type))) return NextResponse.redirect(`${url.origin}/dashboard/admin/control?preview=failed`);
  const jar = await cookies();
  const opts = { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 4 * 60 * 60 };
  jar.set("cl_admin_return", back, opts);
  jar.set("cl_preview", type, { ...opts, httpOnly: false });
  return NextResponse.redirect(`${url.origin}/dashboard`);
}

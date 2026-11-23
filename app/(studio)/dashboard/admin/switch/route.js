// The owner's "Your accounts" (Control Room): open one of the owner's own
// extra accounts (same email + a "+tag", like a Barber or Tutor account)
// in this browser, keeping a way back ("Back to my account") with no
// password. Owner (ADMIN_EMAILS) only, and only the owner's own accounts.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin, isOwnerAlias } from "@/lib/admin";
import { signInAs } from "@/lib/demoAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdmin(user) || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Not found", { status: 404 });

  const { data: target } = await createAdminClient().auth.admin.getUserById(id);
  const email = target?.user?.email;
  if (!email || !isOwnerAlias(email)) return new NextResponse("Not found", { status: 404 });

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const back = session?.refresh_token;
  if (!back) return NextResponse.redirect(`${url.origin}/login`);
  if (!(await signInAs(email))) return NextResponse.redirect(`${url.origin}/dashboard/admin/control?switch=failed`);
  const jar = await cookies();
  jar.set("cl_admin_return", back, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 12 * 60 * 60 });
  return NextResponse.redirect(`${url.origin}/dashboard`);
}

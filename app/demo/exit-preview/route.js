// "Exit preview": back from a demo account to the owner's own account with
// the session kept by /dashboard/admin/preview. The shared demo isn't
// signed out anywhere else.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const origin = new URL(request.url).origin;
  const jar = await cookies();
  const back = jar.get("cl_admin_return")?.value;
  jar.delete("cl_admin_return");
  jar.delete("cl_preview");
  if (!back) return NextResponse.redirect(`${origin}/login`);
  const supabase = await createClient();
  const { error } = await supabase.auth.refreshSession({ refresh_token: back });
  if (error) return NextResponse.redirect(`${origin}/login`);
  return NextResponse.redirect(`${origin}/dashboard/admin/control`);
}

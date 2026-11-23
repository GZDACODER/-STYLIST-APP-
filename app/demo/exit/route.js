// "Start your free trial" from the demo: leave the demo salon, then sign up.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const origin = new URL(request.url).origin;
  const supabase = await createClient();
  // The demo is shared: sign out this browser only.
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.redirect(`${origin}/signup`);
}

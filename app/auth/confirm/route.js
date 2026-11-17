// The links in the "confirm your email" and "reset your password" messages
// land here. We finish logging the stylist in, then send them on: to the
// dashboard, or to "choose a new password" (?next=/reset-password).
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Where a link may send them next (anything else goes to the dashboard).
const NEXT_PAGES = ["/dashboard", "/reset-password"];

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = NEXT_PAGES.includes(searchParams.get("next")) ? searchParams.get("next") : "/dashboard";
  const recovery = type === "recovery" || next === "/reset-password";

  const supabase = await createClient();
  let error = null;

  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type }));
  } else {
    error = new Error("Missing confirmation code");
  }

  if (error) {
    return NextResponse.redirect(recovery ? `${origin}/forgot-password?error=link` : `${origin}/login?error=confirm`);
  }

  return NextResponse.redirect(`${origin}${recovery ? "/reset-password" : next}`);
}

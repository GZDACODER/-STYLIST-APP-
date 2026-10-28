// The link in the "confirm your email" message lands here.
// We finish logging the stylist in, then send them to the dashboard.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");

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
    return NextResponse.redirect(`${origin}/login?error=confirm`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}

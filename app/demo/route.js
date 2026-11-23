// clientelesuite.com/demo: opens the demo salon's dashboard with no password
// (lib/demo.js). Makes the demo account the first time (then fills it with
// demo_reset()), signs this browser in to it with a one-time link made on
// the server, and goes to the dashboard. Nothing to set up for the visitor.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_BUSINESS, DEMO_EMAIL } from "@/lib/demo";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const origin = new URL(request.url).origin;
  const failed = () => NextResponse.redirect(`${origin}/login?error=demo`);
  if (!process.env.SUPABASE_SECRET_KEY) return failed();
  const admin = createAdminClient();

  // The first visit ever: make the demo account and fill it.
  const { error: createError } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    email_confirm: true,
    user_metadata: { business_name: DEMO_BUSINESS, first_name: "Demo", business_type: "hair" },
  });
  if (!createError) await admin.rpc("demo_reset");
  else if (!/already|exists|registered/i.test(createError.message)) {
    console.error("Couldn't make the demo account", createError.message);
    return failed();
  }

  // Sign this browser in (whoever was signed in here before is signed out).
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: DEMO_EMAIL });
  const tokenHash = link?.properties?.hashed_token;
  if (linkError || !tokenHash) {
    console.error("Couldn't open the demo", linkError?.message);
    return failed();
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  if (error) {
    console.error("Couldn't sign in to the demo", error.message);
    return failed();
  }
  return NextResponse.redirect(`${origin}/dashboard`);
}

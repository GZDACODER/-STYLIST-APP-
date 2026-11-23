// clientelesuite.com/demo: opens the demo salon's dashboard with no password
// (lib/demo.js, lib/demoAuth.js).
import { NextResponse } from "next/server";
import { signInToDemo } from "@/lib/demoAuth";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const origin = new URL(request.url).origin;
  const ok = await signInToDemo("hair");
  return NextResponse.redirect(ok ? `${origin}/dashboard` : `${origin}/login?error=demo`);
}

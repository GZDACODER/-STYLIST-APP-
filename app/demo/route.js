// clientelesuite.com/demo: opens a demo dashboard with no password
// (lib/demo.js, lib/demoAuth.js).
import { NextResponse } from "next/server";
import { signInToDemo } from "@/lib/demoAuth";

export const dynamic = "force-dynamic";

// ?type=barber | tattoo | tutor opens that trade's demo (from the homepage's
// trade switcher); anything else opens the salon.
const TYPES = ["hair", "barber", "tattoo", "tutor"];

export async function GET(request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const type = TYPES.includes(url.searchParams.get("type")) ? url.searchParams.get("type") : "hair";
  const ok = await signInToDemo(type);
  return NextResponse.redirect(ok ? `${origin}/dashboard` : `${origin}/login?error=demo`);
}

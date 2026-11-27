// Help mode on the server: is this browser Clientele support inside a pro's
// account? (the cl_help_session cookie, set by /dashboard/admin/help/[id]/enter).
// Server only.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { HELP_BLOCKED, HELP_COOKIE } from "@/lib/helpMode";

export async function helpSessionId() {
  const v = (await cookies()).get(HELP_COOKIE)?.value || "";
  return /^[0-9a-f-]{36}$/i.test(v) ? v : null;
}

// For server actions: { error } when support is inside, else null.
export async function blockedInHelpMode() {
  return (await helpSessionId()) ? { error: HELP_BLOCKED } : null;
}

// For route handlers (Stripe, billing, exports).
export async function blockedRouteInHelpMode() {
  return (await helpSessionId()) ? new NextResponse(HELP_BLOCKED, { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } }) : null;
}

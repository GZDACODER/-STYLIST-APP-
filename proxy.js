import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request) {
  return updateSession(request);
}

export const config = {
  // Run on every page, but skip images, Next.js's own files and the Stripe
  // webhook (it needs Stripe's exact raw request, and no login cookies), and
  // calendar sync links (calendar apps read them with no login).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|api/calendar|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

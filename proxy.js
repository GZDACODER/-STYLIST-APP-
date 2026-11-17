import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request) {
  return updateSession(request);
}

export const config = {
  // Run on every page, but skip images, Next.js's own files and the Stripe
  // webhook (it needs Stripe's exact raw request, and no login cookies).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

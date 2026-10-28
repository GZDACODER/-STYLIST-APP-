// Supabase client for the public booking page.
// Clients who verify with an email code get their own login cookie, kept
// separate from the stylist's, so the two never mix up in one browser.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const BOOKING_COOKIE_NAME = "sb-booking-auth";

export async function createBookingClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: { name: BOOKING_COOKIE_NAME },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a page (which can't set cookies). Safe to ignore:
            // proxy.js refreshes the login cookie on every request.
          }
        },
      },
    }
  );
}

// Runs before every page load: keeps logins fresh and sends logged-out
// visitors away from private pages.
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { BOOKING_COOKIE_NAME } from "./booking";

// Pages that need a logged-in stylist.
const PRIVATE_PATHS = ["/dashboard"];

export async function updateSession(request) {
  // Cookies Supabase wants to update, applied to the response at the end.
  const cookiesToSet = [];

  function makeClient(cookieOptions) {
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      {
        cookieOptions,
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(list) {
            list.forEach(({ name, value }) => request.cookies.set(name, value));
            cookiesToSet.push(...list);
          },
        },
      }
    );
  }

  const {
    data: { user },
  } = await makeClient(undefined).auth.getUser();

  const path = request.nextUrl.pathname;

  // On booking pages, also refresh the client's email-code login.
  if (path.startsWith("/book")) {
    await makeClient({ name: BOOKING_COOKIE_NAME }).auth.getUser();
  }

  const isPrivate = PRIVATE_PATHS.some((p) => path.startsWith(p));
  let response;
  if (!user && isPrivate) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    response = NextResponse.redirect(url);
  } else {
    response = NextResponse.next({ request });
  }

  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

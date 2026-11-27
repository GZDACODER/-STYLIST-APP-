// Supabase client for code that runs on the server
// (pages, server actions, route handlers).
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  // Help mode (0078 SQL): while Clientele support is inside a pro's account,
  // every request carries the session id so the database logs each change.
  const help = cookieStore.get("cl_help_session")?.value;
  const helpHeader = help && /^[0-9a-f-]{36}$/i.test(help) ? { "x-clientele-help": help } : null;

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      ...(helpHeader ? { global: { headers: helpHeader } } : {}),
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

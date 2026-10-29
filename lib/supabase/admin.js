// Supabase client with the SECRET key, for server code only (Stripe payments).
// It skips the database's security rules, so only use it after checking with
// Stripe, and never in code that runs in the browser.
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not set in Vercel.");

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Settings: helpers shared by the section files (server only).
import { getUser } from "@/lib/supabase/user";
import { createClient } from "@/lib/supabase/server";

// The logged-in stylist's row (only these columns), or null.
export async function me(columns) {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return { supabase, user: null, row: null };
  const { data: row } = await supabase.from("stylists").select(columns).eq("id", user.id).maybeSingle();
  return { supabase, user, row: row || {} };
}

// A column that may not exist yet (its SQL not run): "" / null instead.
export async function optional(supabase, userId, column) {
  const { data } = await supabase.from("stylists").select(column).eq("id", userId).maybeSingle();
  return data?.[column] ?? null;
}


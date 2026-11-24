"use server";

// Quick actions' "jump to a client": the pro's client names (row security
// keeps it to their own).
import { createClient } from "@/lib/supabase/server";

export async function quickClients() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase.from("clients").select("id, name").order("name").limit(2000);
  return (data || []).map((c) => ({ id: c.id, name: c.name }));
}

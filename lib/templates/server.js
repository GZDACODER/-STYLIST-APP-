// The logged-in pro's template, for server pages. Read once per request
// (React cache), so the layout and the page share it.
import { getUser } from "@/lib/supabase/user";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { templateFor } from "./index";

export const getMyTemplate = cache(async () => {
  const supabase = await createClient();
  const user = await getUser();
  if (!user) return templateFor("");
  // With the pro's own module choices (step 51 SQL), else without them.
  let { data, error } = await supabase.from("stylists").select("business_type, modules").eq("id", user.id).maybeSingle();
  if (error) ({ data } = await supabase.from("stylists").select("business_type").eq("id", user.id).maybeSingle());
  return templateFor(data?.business_type, data?.modules);
});

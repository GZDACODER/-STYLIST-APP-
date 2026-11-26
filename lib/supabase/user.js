// The logged-in user, checked once per page load. The dashboard layout, the
// template, settings sections and the page all ask; React's cache shares
// the one answer within a request instead of a round trip each. (Server
// actions and route handlers are separate requests and still check for
// themselves.)
import { cache } from "react";
import { createClient } from "./server";

export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

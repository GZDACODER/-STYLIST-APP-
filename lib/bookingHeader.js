// The stylist's name, links and cover photo for the booking pages' top bar
// and panel. One read-only call per page load (shared by the layout and the
// page through React's cache).
import { cache } from "react";
import { createBookingClient } from "@/lib/supabase/booking";

export const loadBookingHeader = cache(async (slug) => {
  const supabase = await createBookingClient();
  const { data, error } = await supabase.rpc("get_booking_header", { p_slug: slug });
  return error ? null : data;
});

// "CUTS BY SAM" -> "Cuts By Sam", so names read in mixed case. Short words
// ("GT", "NYC") stay in capitals, and names already in mixed case are kept.
export function displayName(name) {
  const text = String(name || "");
  if (text !== text.toUpperCase() || !/[A-Z]/.test(text)) return text;
  return text.replace(/[A-Z][A-Z']*/g, (word) =>
    word.length <= 3 ? word : word[0] + word.slice(1).toLowerCase(),
  );
}

// Only https links are used as images.
export function httpsUrl(url) {
  return typeof url === "string" && /^https:\/\//.test(url) ? url : null;
}

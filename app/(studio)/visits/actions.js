"use server";

// Marking a visit from the wrap-up email's link (no login; the pass in the
// link says which business and dates it covers).
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { readVisitPass } from "@/lib/visitPass";
import { OUTCOME_VALUES } from "@/lib/outcomes";
import { nowLocal } from "@/lib/localTime";

export async function setVisitOutcomeWithPass(pass, bookingId, outcome) {
  const access = readVisitPass(pass);
  if (!access) return { error: "This link has expired. Open Wrap up visits from your dashboard instead." };
  if (outcome !== null && !OUTCOME_VALUES.includes(outcome)) return { error: "Unknown choice." };

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, booking_date, start_time, status, stylist:stylists(timezone)")
    .eq("id", String(bookingId))
    .eq("stylist_id", access.stylistId)
    .gte("booking_date", access.from)
    .lte("booking_date", access.to)
    .maybeSingle();
  // Only confirmed visits that have started (the same rule as the dashboard).
  if (
    !booking ||
    booking.status !== "confirmed" ||
    `${booking.booking_date}T${booking.start_time.slice(0, 5)}` > nowLocal(booking.stylist?.timezone || "America/Chicago")
  ) {
    return { error: "That visit can't be marked here. Please refresh." };
  }

  const { error } = await admin
    .from("bookings")
    .update({ outcome, outcome_at: outcome ? new Date().toISOString() : null })
    .eq("id", booking.id);
  if (error) return { error: "That couldn't be saved. Please try again." };

  revalidatePath("/visits");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/wrapup");
  return { success: true };
}

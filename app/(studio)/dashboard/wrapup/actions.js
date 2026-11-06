"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { OUTCOME_VALUES } from "@/lib/outcomes";

// Marks how one visit went (or clears it with null).
export async function setVisitOutcome(bookingId, outcome) {
  if (outcome !== null && !OUTCOME_VALUES.includes(outcome)) return { error: "Unknown choice." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_visit_outcome", {
    p_booking_id: String(bookingId),
    p_outcome: outcome,
  });
  if (error) {
    if (/set_visit_outcome/.test(error.message) && /does not exist|schema cache|Could not find/.test(error.message)) {
      return { error: "Run the step 18 SQL (0023_visit_outcomes.sql) in Supabase first." };
    }
    return { error: "That couldn't be saved. Please refresh and try again." };
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/wrapup");
  return { success: true };
}

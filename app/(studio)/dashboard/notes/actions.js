"use server";

// Saving a visit's note and the amount still owed (see 0029_visit_notes.sql).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseDollars } from "@/lib/money";

const ERRORS = {
  not_logged_in: "Please log in again.",
  note_too_long: "Please keep the note under 1000 characters.",
  invalid_amount: "That amount doesn't look right.",
  not_found: "That visit can't be changed. Please refresh.",
};

// owed: the amount as typed ("40", "$40.50"), or "" to clear it.
export async function setVisitNote(bookingId, note, owed) {
  const text = String(note || "").trim();
  if (text.length > 1000) return { error: ERRORS.note_too_long };
  const owedCents = parseDollars(owed);
  if (Number.isNaN(owedCents) || owedCents > 10000000) {
    return { error: "Type the amount owed as a number, like 40 or 40.50." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_visit_note", {
    p_booking_id: String(bookingId),
    p_note: text,
    p_owed_cents: owedCents,
  });
  if (error) {
    const message = String(error.message || "");
    const known = Object.keys(ERRORS).find((code) => message.includes(code));
    if (known) return { error: ERRORS[known] };
    if (/set_visit_note/.test(message)) {
      return { error: "Visit notes aren't set up yet: run the step 24 SQL (0029_visit_notes.sql) in Supabase." };
    }
    console.error("Saving a visit note failed", error.code, error.message);
    return { error: "That couldn't be saved. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/notes");
  revalidatePath("/dashboard/wrapup");
  return { success: true };
}

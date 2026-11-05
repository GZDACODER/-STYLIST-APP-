"use server";

// Standing appointments: a Regular's same service, day and time every few
// weeks. The rules are enforced by the database functions in
// supabase/migrations/0021_standing_appointments.sql.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidDateString } from "@/lib/availability";
import { planErrorMessage } from "@/lib/plan";

const ERRORS = {
  not_regular: "Only Regulars can have a standing appointment.",
  invalid_service: "Please pick a service.",
  invalid_interval: "Please pick how often: every 2 to 12 weeks.",
  invalid_time: "Please pick a day and time.",
  invalid_start: "Please pick a start date from today on (up to a year ahead).",
  invalid_end: "The end date needs to be after the first visit.",
  invalid_deposit: "Please pick a deposit option.",
  too_late: "That time runs past midnight. Please pick an earlier time.",
  slot_taken: "That time is already booked. Please pick another time.",
  not_found: "That couldn't be found. Please refresh the page.",
};

function message(error) {
  const text = String(error?.message || "");
  // Before the SQL (0021) is run, Supabase can't find the function.
  if (/standing_/.test(text) && /does not exist|schema cache|Could not find/.test(text)) {
    return "Standing appointments need the SQL from step 16 (0021_standing_appointments.sql) run in Supabase first.";
  }
  const plan = planErrorMessage(error);
  if (plan) return plan.replace("this can't be turned on", "standing appointments can't be set up");
  const key = Object.keys(ERRORS).find((k) => text.includes(k));
  return key ? ERRORS[key] : "Something went wrong. Please try again.";
}

function refresh() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/clients");
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// The "Set standing appointment" form on a Regular's client card.
export async function createStanding(prevState, formData) {
  const clientId = String(formData.get("client_id") || "");
  const serviceId = String(formData.get("service_id") || "");
  const weeks = Number(formData.get("interval_weeks"));
  const weekday = Number(formData.get("weekday"));
  const time = String(formData.get("time") || "");
  const startDate = String(formData.get("start_date") || "");
  const endDate = String(formData.get("end_date") || "");
  const depositMode = formData.get("deposit_mode") === "each" ? "each" : "none";

  if (!serviceId) return { error: ERRORS.invalid_service };
  if (!Number.isInteger(weeks) || weeks < 2 || weeks > 12) return { error: ERRORS.invalid_interval };
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !TIME_PATTERN.test(time)) {
    return { error: ERRORS.invalid_time };
  }
  if (!isValidDateString(startDate)) return { error: ERRORS.invalid_start };
  if (endDate && !isValidDateString(endDate)) return { error: ERRORS.invalid_end };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("standing_create", {
    p_client_id: clientId,
    p_service_id: serviceId,
    p_interval_weeks: weeks,
    p_weekday: weekday,
    p_time: time,
    p_start_date: startDate,
    p_end_date: endDate || null,
    p_deposit_mode: depositMode,
  });
  if (error) return { error: message(error) };

  refresh();
  const held = data?.held || 0;
  const clashes = data?.clashes || 0;
  let success = held === 1 ? "Set. 1 visit is booked." : `Set. ${held} visits are booked for the next 3 months.`;
  if (clashes) {
    success += ` ${clashes === 1 ? "1 date was" : `${clashes} dates were`} already taken, so ${
      clashes === 1 ? "it's" : "they're"
    } flagged on the Today page.`;
  }
  return { success, savedAt: Date.now() };
}

// Skip one visit (Calendar). Returns { error } or nothing.
export async function skipStandingVisit(formData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("standing_skip", {
    p_booking_id: String(formData.get("id") || ""),
  });
  if (error) console.error("Skipping a standing visit failed", error.message);
  refresh();
}

// Move one visit (Calendar).
export async function moveStandingVisit(prevState, formData) {
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  if (!isValidDateString(date) || !TIME_PATTERN.test(time)) return { error: ERRORS.invalid_time };

  const supabase = await createClient();
  const { error } = await supabase.rpc("standing_move", {
    p_booking_id: String(formData.get("id") || ""),
    p_date: date,
    p_time: time,
  });
  if (error) {
    return {
      error: String(error.message).includes("invalid_time")
        ? "Please pick a day and time that hasn't passed."
        : message(error),
    };
  }
  refresh();
  return { success: "Moved. They'll get an email with the new time.", savedAt: Date.now() };
}

// End a series (client card or Calendar).
export async function endStanding(formData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("standing_end", {
    p_series_id: String(formData.get("series_id") || ""),
  });
  if (error) console.error("Ending a standing appointment failed", error.message);
  refresh();
}

// Today page: "Keep it" on a flagged visit, or "Dismiss" on a date that
// couldn't be held.
export async function dismissStandingFlag(formData) {
  const bookingId = String(formData.get("booking_id") || "");
  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "standing_dismiss",
    bookingId
      ? { p_booking_id: bookingId }
      : {
          p_series_id: String(formData.get("series_id") || ""),
          p_date: String(formData.get("date") || ""),
        }
  );
  if (error) console.error("Dismissing a standing flag failed", error.message);
  refresh();
}

"use server";

// Server actions for weekly hours and blocked dates.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { WEEKDAYS, isValidDateString, parseDateString, toDateString } from "@/lib/availability";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
// Longest stretch that can be blocked in one go (about three months).
const MAX_BLOCK_DAYS = 92;

async function getUserAndClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function saveHours(prevState, formData) {
  const rows = [];

  for (const day of WEEKDAYS) {
    const isWorking = formData.get(`working_${day.dow}`) === "on";
    const start = String(formData.get(`start_${day.dow}`) || "");
    const end = String(formData.get(`end_${day.dow}`) || "");

    if (isWorking) {
      if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
        return { error: `Please set a start and end time for ${day.name}.` };
      }
      // "HH:MM" text compares correctly as long as both are zero-padded.
      if (end <= start) {
        return { error: `On ${day.name}, the end time must be after the start time.` };
      }
    }

    rows.push({
      weekday: day.dow,
      is_working: isWorking,
      start_time: isWorking ? start : null,
      end_time: isWorking ? end : null,
    });
  }

  const { supabase, user } = await getUserAndClient();
  if (!user) return { error: "Please log in again." };

  const { error } = await supabase
    .from("working_hours")
    .upsert(
      rows.map((row) => ({ ...row, stylist_id: user.id })),
      { onConflict: "stylist_id,weekday" }
    );

  if (error) return { error: error.message };

  revalidatePath("/dashboard/availability");
  return { success: "Working hours saved." };
}

export async function blockDates(prevState, formData) {
  const start = String(formData.get("start_date") || "");
  const endText = String(formData.get("end_date") || "");
  const reason = String(formData.get("reason") || "").trim();
  const values = { start_date: start, end_date: endText, reason };

  if (!isValidDateString(start)) return { error: "Please pick a date.", values };
  const end = endText || start;
  if (!isValidDateString(end)) return { error: "The \"until\" date isn't valid.", values };
  if (end < start) {
    return { error: "The \"until\" date must be the same as or after the first date.", values };
  }
  if (reason.length > 100) return { error: "Please keep the note under 100 characters.", values };

  // One row for every date from start to end.
  const dates = [];
  for (let d = parseDateString(start); toDateString(d) <= end; d.setDate(d.getDate() + 1)) {
    dates.push(toDateString(d));
    if (dates.length > MAX_BLOCK_DAYS) {
      return { error: `You can block up to ${MAX_BLOCK_DAYS} days at a time.`, values };
    }
  }

  const { supabase, user } = await getUserAndClient();
  if (!user) return { error: "Please log in again.", values };

  const { error } = await supabase.from("blocked_dates").upsert(
    dates.map((blocked_on) => ({ stylist_id: user.id, blocked_on, reason: reason || null })),
    // Dates that are already blocked are simply skipped.
    { onConflict: "stylist_id,blocked_on", ignoreDuplicates: true }
  );

  if (error) return { error: error.message, values };

  revalidatePath("/dashboard/availability");
  return {
    success: dates.length === 1 ? "Date blocked." : `${dates.length} dates blocked.`,
  };
}

export async function unblockDate(formData) {
  const id = String(formData.get("id") || "");
  const { supabase } = await getUserAndClient();

  // The database's security rules only let a stylist remove their own dates.
  await supabase.from("blocked_dates").delete().eq("id", id);

  revalidatePath("/dashboard/availability");
}

"use server";

// Settings → Holidays: close (or reopen) on a federal holiday. Closed
// holidays take that day's times off the booking page, the waitlist and
// reschedule, and standing appointments skip them (step 34 SQL).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { FEDERAL_HOLIDAYS, nextHolidayDate } from "@/lib/holidays";
import { clockTime, formatDate, todayInTimeZone } from "@/lib/availability";
import { siteOrigin } from "@/lib/stripe";
import { runWaitlistSafely } from "@/lib/waitlist";

export async function setHolidayClosed(prevState, formData) {
  const key = String(formData.get("holiday_key") || "");
  const closed = formData.get("closed") === "on";
  const holiday = FEDERAL_HOLIDAYS.find((h) => h.key === key);
  if (!holiday) return { error: "Unknown holiday." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const { error } = await supabase
    .from("stylist_holiday_settings")
    .upsert({ stylist_id: user.id, holiday_key: key, closed, updated_at: new Date().toISOString() });
  if (error) {
    return {
      error: /stylist_holiday_settings/.test(error.message)
        ? "Holidays aren't set up yet. Run supabase/migrations/0039_calendar_extras.sql in Supabase first."
        : error.message,
    };
  }

  // Standing appointments: skip (or book again) that day straight away.
  const { error: refillError } = await supabase.rpc("standing_refill_mine");
  if (refillError && !/standing_refill_mine/.test(refillError.message)) console.error("standing_refill_mine failed", refillError.message);
  // Reopened: the time is free again, so tell the waitlist.
  if (!closed) await runWaitlistSafely(user.id, await siteOrigin());

  revalidatePath("/dashboard/settings", "layout");
  revalidatePath("/dashboard/availability");
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/today");

  if (!closed) return { success: `Open on ${holiday.name} again.`, key };

  // Bookings already on the next one stay booked: warn, never cancel.
  const { data: stylist } = await supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle();
  const next = nextHolidayDate(key, todayInTimeZone(stylist?.timezone || "America/Chicago"));
  let warning = null;
  if (next) {
    const { data: clashes } = await supabase
      .from("bookings")
      .select("client_name, start_time")
      .eq("status", "confirmed")
      .eq("booking_date", next)
      .order("start_time");
    if (clashes?.length) {
      const names = clashes.slice(0, 5).map((b) => `${b.client_name} at ${clockTime(b.start_time)}`).join("; ");
      warning = `${clashes.length === 1 ? "A booking is" : `${clashes.length} bookings are`} already on ${formatDate(next)}: ${names}${
        clashes.length > 5 ? ` and ${clashes.length - 5} more` : ""
      }. ${clashes.length === 1 ? "It stays" : "They stay"} booked; move or cancel ${clashes.length === 1 ? "it" : "them"} if you need to.`;
    }
  }
  return { success: `Closed on ${holiday.name}${next ? ` (next: ${formatDate(next)})` : ""}.`, warning, key };
}

// "Closed – Thanksgiving" (the label a one-off holiday closure is saved with).
const closedLabel = (name) => `Closed – ${name}`;

// Calendar: close (or reopen) on ONE date of a holiday, e.g. just this
// Thanksgiving. Saved as a blocked date with the reason "Closed – <name>",
// so it works like any day off and needs no extra SQL.
export async function setHolidayDateClosed(prevState, formData) {
  const key = String(formData.get("holiday_key") || "");
  const date = String(formData.get("date") || "");
  const closed = formData.get("closed") === "on";
  const holiday = FEDERAL_HOLIDAYS.find((h) => h.key === key);
  if (!holiday || nextHolidayDate(key, date) !== date) return { error: "That isn't the date of this holiday." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const reason = closedLabel(holiday.name);
  if (closed) {
    const { error } = await supabase
      .from("blocked_dates")
      .upsert({ stylist_id: user.id, blocked_on: date, reason }, { onConflict: "stylist_id,blocked_on", ignoreDuplicates: true });
    if (error) return { error: error.message };
  } else {
    // Only the holiday closure: a day blocked for another reason stays blocked.
    const { error } = await supabase.from("blocked_dates").delete().eq("blocked_on", date).eq("reason", reason);
    if (error) return { error: error.message };
    await runWaitlistSafely(user.id, await siteOrigin());
  }
  const { error: refillError } = await supabase.rpc("standing_refill_mine");
  if (refillError && !/standing_refill_mine/.test(refillError.message)) console.error("standing_refill_mine failed", refillError.message);

  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/availability");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/today");
  if (!closed) return { success: `Open on ${formatDate(date)} again.` };

  const { data: clashes } = await supabase
    .from("bookings")
    .select("client_name, start_time")
    .eq("status", "confirmed")
    .eq("booking_date", date)
    .order("start_time");
  const warning = clashes?.length
    ? `${clashes.length === 1 ? "A booking is" : `${clashes.length} bookings are`} already that day: ${clashes
        .slice(0, 5)
        .map((b) => `${b.client_name} at ${clockTime(b.start_time)}`)
        .join("; ")}. ${clashes.length === 1 ? "It stays" : "They stay"} booked; move or cancel ${clashes.length === 1 ? "it" : "them"} if you need to.`
    : null;
  return { success: `Closed on ${formatDate(date)}.`, warning };
}

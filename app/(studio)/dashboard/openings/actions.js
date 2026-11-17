"use server";

// Server actions for posting openings.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { planErrorMessage } from "@/lib/plan";
import { siteOrigin } from "@/lib/stripe";
import { runWaitlistSafely } from "@/lib/waitlist";
import {
  isValidDateString,
  parseDateString,
  toDateString,
  todayInTimeZone,
} from "@/lib/availability";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const VISIBILITIES = ["everyone", "regulars"];
// Longest stretch that can be opened in one go.
const MAX_DAYS = 60;

async function getUserAndClient() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function postOpenings(prevState, formData) {
  const start = String(formData.get("start_date") || "");
  const endText = String(formData.get("end_date") || "");
  const mode = String(formData.get("times") || "hours");
  const fromTime = String(formData.get("from") || "");
  const toTime = String(formData.get("to") || "");
  const visibility = String(formData.get("visibility") || "");
  // Days off are skipped unless the stylist ticked "open my days off too".
  const includeDaysOff = formData.get("include_days_off") === "on";

  if (!isValidDateString(start)) return { error: "Please pick a date." };
  const end = endText || start;
  if (!isValidDateString(end)) return { error: 'The "until" date isn\'t valid.' };
  if (end < start) return { error: 'The "until" date must be on or after the first date.' };
  if (!VISIBILITIES.includes(visibility)) return { error: "Please choose who can book." };
  if (mode === "custom") {
    if (!TIME_PATTERN.test(fromTime) || !TIME_PATTERN.test(toTime)) {
      return { error: "Please set a start and end time." };
    }
    if (toTime <= fromTime) return { error: "The end time must be after the start time." };
  }

  const dates = [];
  for (let d = parseDateString(start); toDateString(d) <= end; d.setDate(d.getDate() + 1)) {
    dates.push({ text: toDateString(d), dow: d.getDay() });
    if (dates.length > MAX_DAYS) return { error: `You can open up to ${MAX_DAYS} days at a time.` };
  }

  const { supabase, user } = await getUserAndClient();
  if (!user) return { error: "Please log in again." };

  const { data: stylist } = await supabase
    .from("stylists")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle();
  if (!stylist) return { error: "Only stylist accounts can post openings." };
  if (start < todayInTimeZone(stylist.timezone)) {
    return { error: "That date has already passed." };
  }

  const [{ data: hourRows }, { data: blockedRows }, { data: existing }] = await Promise.all([
    supabase.from("working_hours").select("weekday, is_working, start_time, end_time"),
    supabase.from("blocked_dates").select("blocked_on").gte("blocked_on", start).lte("blocked_on", end),
    supabase
      .from("openings")
      .select("opening_date, start_time, end_time")
      .gte("opening_date", start)
      .lte("opening_date", end),
  ]);

  const hoursByDay = Object.fromEntries((hourRows || []).map((h) => [h.weekday, h]));
  const blocked = new Set((blockedRows || []).map((b) => b.blocked_on));

  if (mode === "hours" && !hourRows?.length) {
    return { error: "You haven't saved your weekly hours yet. Set them on the Availability tab, or choose custom times." };
  }

  const rows = [];
  const skipped = { blocked: 0, off: 0, overlap: 0 };

  for (const date of dates) {
    if (blocked.has(date.text)) {
      skipped.blocked++;
      continue;
    }

    const day = hoursByDay[date.dow];
    const isDayOff = day && !day.is_working;

    let from = fromTime;
    let to = toTime;
    if (mode === "hours") {
      if (!day?.is_working) {
        skipped.off++;
        continue;
      }
      from = day.start_time.slice(0, 5);
      to = day.end_time.slice(0, 5);
    } else if (isDayOff && !includeDaysOff) {
      skipped.off++;
      continue;
    }

    // Skip if it would overlap an opening that's already posted that day.
    const overlaps = (existing || []).some(
      (o) =>
        o.opening_date === date.text &&
        o.start_time.slice(0, 5) < to &&
        o.end_time.slice(0, 5) > from
    );
    if (overlaps) {
      skipped.overlap++;
      continue;
    }

    rows.push({
      stylist_id: user.id,
      opening_date: date.text,
      start_time: from,
      end_time: to,
      visibility,
    });
  }

  const notes = [];
  if (skipped.off) notes.push(`${skipped.off} day${skipped.off > 1 ? "s" : ""} off`);
  if (skipped.blocked) notes.push(`${skipped.blocked} blocked`);
  if (skipped.overlap) notes.push(`${skipped.overlap} already open`);
  const skippedText = notes.length ? ` Skipped: ${notes.join(", ")}.` : "";

  if (rows.length === 0) return { error: `Nothing new to open.${skippedText}` };

  const { error } = await supabase.from("openings").insert(rows);
  if (error) {
    // 23P01 = "exclusion violation": overlaps an opening.
    if (error.code === "23P01") return { error: "That overlaps an opening you've already posted." };
    return { error: planErrorMessage(error) || error.message };
  }

  // New times: tell anyone on the waitlist who wants them.
  const { told } = await runWaitlistSafely(user.id, await siteOrigin());
  const toldText = told
    ? ` ${told} ${told === 1 ? "client" : "clients"} on your waitlist ${told === 1 ? "was" : "were"} emailed.`
    : "";

  revalidatePath("/dashboard/openings");
  return {
    success: `Opened ${rows.length} day${rows.length > 1 ? "s" : ""}.${skippedText}${toldText}`,
  };
}

// Called directly when a visibility button is tapped on one opening.
export async function setOpeningVisibility(id, visibility) {
  if (!VISIBILITIES.includes(visibility)) return { error: "Unknown option." };
  const { supabase, user } = await getUserAndClient();
  if (!user) return { error: "Please log in again." };
  const { data: opening, error } = await supabase
    .from("openings")
    .update({ visibility })
    .eq("id", String(id))
    .select("opening_date, start_time, end_time")
    .maybeSingle();
  if (error) return { error: planErrorMessage(error) || error.message };
  if (visibility === "everyone") {
    // Freed times kept for Regulars inside it open to everyone too.
    if (opening) {
      await supabase
        .from("regulars_holds")
        .delete()
        .eq("hold_date", opening.opening_date)
        .lt("start_time", opening.end_time)
        .gt("end_time", opening.start_time);
    }
    // Opening a "Regulars only" time to everyone is news for the waitlist.
    await runWaitlistSafely(user.id, await siteOrigin());
  }
  revalidatePath("/dashboard/openings");
  return { success: true };
}

export async function deleteOpening(formData) {
  const id = String(formData.get("id") || "");
  const { supabase } = await getUserAndClient();
  // The database's security rules only let a stylist remove their own openings.
  await supabase.from("openings").delete().eq("id", id);
  revalidatePath("/dashboard/openings");
}

// A freed time from a cancelled Regulars booking: let everyone book it.
export async function openHoldToEveryone(formData) {
  const id = String(formData.get("id") || "");
  const { supabase, user } = await getUserAndClient();
  if (!user) return;
  // The database's security rules only let a stylist remove their own holds.
  await supabase.from("regulars_holds").delete().eq("id", id);
  await runWaitlistSafely(user.id, await siteOrigin());
  revalidatePath("/dashboard/openings");
}

// ⋯ → Edit: change one opening's date and times. Bookings already in it
// stay booked (even if they're now outside it).
export async function updateOpening(prevState, formData) {
  const id = String(formData.get("id") || "");
  const date = String(formData.get("date") || "");
  const from = String(formData.get("from") || "");
  const to = String(formData.get("to") || "");
  if (!isValidDateString(date)) return { error: "Please pick a date." };
  if (!TIME_PATTERN.test(from) || !TIME_PATTERN.test(to)) return { error: "Please set a start and end time." };
  if (to <= from) return { error: "The end time must be after the start time." };

  const { supabase, user } = await getUserAndClient();
  if (!user) return { error: "Please log in again." };
  const { data: stylist } = await supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle();
  if (stylist && date < todayInTimeZone(stylist.timezone)) return { error: "That date has already passed." };

  const { data, error } = await supabase
    .from("openings")
    .update({ opening_date: date, start_time: from, end_time: to })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23P01") return { error: "That overlaps another opening on that day." };
    return { error: planErrorMessage(error) || error.message };
  }
  if (!data) return { error: "That opening isn't there any more." };
  // It may have new times in it: tell the waitlist.
  await runWaitlistSafely(user.id, await siteOrigin());
  revalidatePath("/dashboard/openings");
  return { success: "Saved.", savedAt: Date.now() };
}

// ⋯ → Duplicate: the same times and audience on another date (or every
// day from that date to an "until" date, skipping days that overlap).
export async function duplicateOpening(prevState, formData) {
  const id = String(formData.get("id") || "");
  const start = String(formData.get("date") || "");
  const until = String(formData.get("until") || "") || start;
  const sameWeekday = formData.get("same_weekday") === "on";
  if (!isValidDateString(start) || !isValidDateString(until)) return { error: "Please pick a date." };
  if (until < start) return { error: 'The "until" date must be on or after the first date.' };

  const { supabase, user } = await getUserAndClient();
  if (!user) return { error: "Please log in again." };
  const { data: o } = await supabase
    .from("openings")
    .select("opening_date, start_time, end_time, visibility")
    .eq("id", id)
    .maybeSingle();
  if (!o) return { error: "That opening isn't there any more." };
  const { data: stylist } = await supabase.from("stylists").select("timezone").eq("id", user.id).maybeSingle();
  if (stylist && start < todayInTimeZone(stylist.timezone)) return { error: "That date has already passed." };

  const weekday = parseDateString(o.opening_date).getDay();
  const dates = [];
  for (let d = parseDateString(start); toDateString(d) <= until; d.setDate(d.getDate() + 1)) {
    if (!sameWeekday || d.getDay() === weekday) dates.push(toDateString(d));
    if (dates.length > MAX_DAYS) return { error: `You can copy to up to ${MAX_DAYS} days at a time.` };
  }
  if (!dates.length) return { error: "No matching days in those dates." };

  const { data: existing } = await supabase
    .from("openings")
    .select("opening_date, start_time, end_time")
    .gte("opening_date", start)
    .lte("opening_date", until);
  const rows = dates
    .filter(
      (date) =>
        !(existing || []).some(
          (e) => e.opening_date === date && e.start_time < o.end_time && e.end_time > o.start_time
        )
    )
    .map((date) => ({
      stylist_id: user.id,
      opening_date: date,
      start_time: o.start_time,
      end_time: o.end_time,
      visibility: o.visibility,
    }));
  const skipped = dates.length - rows.length;
  if (!rows.length) return { error: "Those days already have an opening at that time." };
  const { error } = await supabase.from("openings").insert(rows);
  if (error) return { error: planErrorMessage(error) || error.message };
  await runWaitlistSafely(user.id, await siteOrigin());
  revalidatePath("/dashboard/openings");
  return {
    success: `Copied to ${rows.length} day${rows.length > 1 ? "s" : ""}.${skipped ? ` Skipped ${skipped} already open.` : ""}`,
    savedAt: Date.now(),
  };
}

// Select → several openings: "everyone", "regulars" or "remove".
export async function bulkOpenings(ids, op) {
  const list = (Array.isArray(ids) ? ids : []).map(String).filter(Boolean).slice(0, 500);
  if (!list.length) return { error: "Pick at least one opening." };
  const { supabase, user } = await getUserAndClient();
  if (!user) return { error: "Please log in again." };
  if (op === "remove") {
    const { error } = await supabase.from("openings").delete().in("id", list);
    if (error) return { error: error.message };
  } else if (VISIBILITIES.includes(op)) {
    const { data: rows, error } = await supabase
      .from("openings")
      .update({ visibility: op })
      .in("id", list)
      .select("opening_date, start_time, end_time");
    if (error) return { error: planErrorMessage(error) || error.message };
    if (op === "everyone") {
      for (const o of rows || []) {
        await supabase
          .from("regulars_holds")
          .delete()
          .eq("hold_date", o.opening_date)
          .lt("start_time", o.end_time)
          .gt("end_time", o.start_time);
      }
      await runWaitlistSafely(user.id, await siteOrigin());
    }
  } else {
    return { error: "Unknown option." };
  }
  revalidatePath("/dashboard/openings");
  return { success: true };
}

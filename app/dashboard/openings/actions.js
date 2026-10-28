"use server";

// Server actions for the booking link and for posting openings.
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  isValidDateString,
  isValidTimeZone,
  parseDateString,
  toDateString,
  todayInTimeZone,
} from "@/lib/availability";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
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

export async function saveBookingLink(prevState, formData) {
  const slug = String(formData.get("slug") || "").trim().toLowerCase();
  const timezone = String(formData.get("timezone") || "").trim();

  if (slug.length < 3 || slug.length > 40 || !SLUG_PATTERN.test(slug)) {
    return {
      error:
        "Your link can use lowercase letters, numbers and single dashes (3 to 40 characters), like cuts-by-sam.",
    };
  }
  if (!isValidTimeZone(timezone)) return { error: "Please pick your time zone." };

  const { supabase, user } = await getUserAndClient();
  if (!user) return { error: "Please log in again." };

  const { error } = await supabase
    .from("stylists")
    .update({ slug, timezone })
    .eq("id", user.id);

  if (error) {
    // 23505 = "unique violation": another stylist already has this link.
    if (error.code === "23505") return { error: "That link is already taken. Try another." };
    return { error: error.message };
  }

  revalidatePath("/dashboard", "layout");
  return { success: "Saved." };
}

export async function postOpenings(prevState, formData) {
  const start = String(formData.get("start_date") || "");
  const endText = String(formData.get("end_date") || "");
  const mode = String(formData.get("times") || "hours");
  const fromTime = String(formData.get("from") || "");
  const toTime = String(formData.get("to") || "");
  const visibility = String(formData.get("visibility") || "");

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

    let from = fromTime;
    let to = toTime;
    if (mode === "hours") {
      const day = hoursByDay[date.dow];
      if (!day?.is_working) {
        skipped.off++;
        continue;
      }
      from = day.start_time.slice(0, 5);
      to = day.end_time.slice(0, 5);
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
    return { error: error.message };
  }

  revalidatePath("/dashboard/openings");
  return {
    success: `Opened ${rows.length} day${rows.length > 1 ? "s" : ""}.${skippedText}`,
  };
}

// Called directly when a visibility button is tapped on one opening.
export async function setOpeningVisibility(id, visibility) {
  if (!VISIBILITIES.includes(visibility)) return { error: "Unknown option." };
  const { supabase } = await getUserAndClient();
  const { error } = await supabase.from("openings").update({ visibility }).eq("id", String(id));
  if (error) return { error: error.message };
  revalidatePath("/dashboard/openings");
  return { success: true };
}

// Same, for every opening on one day.
export async function setDayVisibility(date, visibility) {
  if (!VISIBILITIES.includes(visibility) || !isValidDateString(String(date))) {
    return { error: "Unknown option." };
  }
  const { supabase, user } = await getUserAndClient();
  if (!user) return { error: "Please log in again." };
  const { error } = await supabase
    .from("openings")
    .update({ visibility })
    .eq("stylist_id", user.id)
    .eq("opening_date", date);
  if (error) return { error: error.message };
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

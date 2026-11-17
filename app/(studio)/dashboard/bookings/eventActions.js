"use server";

// Personal events on the Calendar: add, edit, delete (one date or all).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clockTime, formatDate, isValidDateString } from "@/lib/availability";
import { COLORS, MONTHLY_MODES, REPEATS } from "@/lib/calendarEvents";
import { siteOrigin } from "@/lib/stripe";
import { runWaitlistSafely } from "@/lib/waitlist";

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const NOT_SET_UP =
  "Events aren't set up yet. Run supabase/migrations/0034_calendar_events.sql in Supabase first.";

function refresh() {
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard");
}

// Standing appointments skip times blocked by events (step 31 SQL): check
// them again now, so freed dates are booked and blocked ones are noted.
// Does nothing before that SQL is run.
async function refillStanding(supabase) {
  const { error } = await supabase.rpc("standing_refill_mine");
  if (error && !/standing_refill_mine/.test(error.message)) {
    console.error("standing_refill_mine failed", error.message);
  }
}

// Freed time (an event no longer blocking bookings): tell the waitlist.
async function tellWaitlist(userId) {
  await runWaitlistSafely(userId, await siteOrigin());
}

// "YYYY-MM-DD" one day earlier.
function dayBefore(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

// Saves with the step 34 columns (colour, repeat days, monthly mode); before
// that SQL is run, saves without them.
async function writeEvent(query, row, extras) {
  let result = await query({ ...row, ...extras });
  if (result.error && /color|repeat_days|monthly_mode/.test(result.error.message || "")) {
    result = await query(row);
  }
  return result;
}

// scope (editing a repeating event, opened from the date `occurrence`):
//   "all"       - every date (the default)
//   "one"       - just that date: it's skipped in the series, and a one-off
//                 event with the changes takes its place
//   "following" - that date and later: the series ends the day before, and
//                 a new series with the changes starts there
export async function saveEvent(prevState, formData) {
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const startsOn = String(formData.get("starts_on") || "");
  // All day only when asked for ("on"), never because times are missing
  // from the form; a timed event needs both times (checked below).
  const allDay = formData.get("all_day") === "on";
  const start = String(formData.get("start_time") || "");
  const end = String(formData.get("end_time") || "");
  const repeats = String(formData.get("repeats") || "none");
  const until = String(formData.get("repeat_until") || "");
  const blocks = formData.get("blocks_bookings") === "on";
  const note = String(formData.get("note") || "").trim();
  const color = String(formData.get("color") || "gray");
  const repeatDays = [...new Set(formData.getAll("repeat_days").map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const monthlyMode = String(formData.get("monthly_mode") || "date");
  const scope = String(formData.get("scope") || "all");
  const occurrence = String(formData.get("occurrence") || "");

  if (!title) return { error: "Please give the event a name." };
  if (title.length > 80) return { error: "Please keep the name under 80 characters." };
  if (!isValidDateString(startsOn)) return { error: "Please pick a date." };
  if (!allDay) {
    if (!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)) {
      return { error: "Please pick a start and end time, or tick All day." };
    }
    if (end <= start) return { error: "The end time must be after the start time." };
  }
  if (!REPEATS.includes(repeats)) return { error: "Please pick how often it repeats." };
  if (repeats !== "none" && until) {
    if (!isValidDateString(until)) return { error: "The \"until\" date isn't valid." };
    if (until < startsOn) return { error: "The \"until\" date must be on or after the first date." };
  }
  if (note.length > 300) return { error: "Please keep the note under 300 characters." };
  if (!COLORS[color]) return { error: "Please pick one of the colours." };
  if (!MONTHLY_MODES.includes(monthlyMode)) return { error: "Please pick how it repeats each month." };
  if (["weekly", "biweekly"].includes(repeats) && formData.has("repeat_days_shown") && repeatDays.length === 0) {
    return { error: "Please pick at least one day of the week." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in again." };

  const row = {
    title,
    starts_on: startsOn,
    start_time: allDay ? null : start,
    end_time: allDay ? null : end,
    repeats,
    repeat_until: repeats !== "none" && until ? until : null,
    blocks_bookings: blocks,
    note: note || null,
  };
  const extras = {
    color,
    repeat_days: ["weekly", "biweekly"].includes(repeats) ? repeatDays : [],
    monthly_mode: repeats === "monthly" ? monthlyMode : "date",
  };
  const insertNew = (fields) => (r) =>
    supabase.from("calendar_events").insert({ ...r, ...fields, stylist_id: user.id }).select("id").single();

  let saved;
  let wasBlocking = false;
  if (id) {
    const { data: before } = await supabase
      .from("calendar_events")
      .select("blocks_bookings, repeats, starts_on, skipped_dates")
      .eq("id", id)
      .maybeSingle();
    if (!before) return { error: "That event isn't there any more." };
    wasBlocking = Boolean(before.blocks_bookings);
    const repeating = before.repeats !== "none";
    const validOccurrence = repeating && isValidDateString(occurrence) && occurrence >= before.starts_on;

    if (scope === "one" && validOccurrence) {
      // Skip that date in the series, and put a one-off event there instead.
      const skipped = [...new Set([...(before.skipped_dates || []), occurrence])];
      const { error: skipError } = await supabase.from("calendar_events").update({ skipped_dates: skipped }).eq("id", id);
      if (skipError) return { error: skipError.message };
      const { data, error } = await writeEvent(insertNew({ repeats: "none", repeat_until: null }), row, {
        ...extras,
        repeat_days: [],
        monthly_mode: "date",
      });
      if (error) return { error: error.message };
      saved = data;
    } else if (scope === "following" && validOccurrence && occurrence > before.starts_on) {
      // End the series the day before, and start a new one from there.
      const { error: endError } = await supabase
        .from("calendar_events")
        .update({ repeat_until: dayBefore(occurrence) })
        .eq("id", id);
      if (endError) return { error: endError.message };
      const carried = (before.skipped_dates || []).filter((d) => d >= startsOn);
      const { data, error } = await writeEvent(insertNew({ skipped_dates: carried }), row, extras);
      if (error) return { error: error.message };
      saved = data;
    } else {
      const { data, error } = await writeEvent(
        (r) => supabase.from("calendar_events").update(r).eq("id", id).select("id").maybeSingle(),
        row,
        extras
      );
      if (error) return { error: error.code === "42P01" ? NOT_SET_UP : error.message };
      if (!data) return { error: "That event isn't there any more." };
      saved = data;
    }
  } else {
    const { data, error } = await writeEvent(insertNew({}), row, extras);
    if (error) return { error: error.code === "42P01" ? NOT_SET_UP : error.message };
    saved = data;
  }

  // An edit may have freed time that was blocked before.
  if (wasBlocking) await tellWaitlist(user.id);
  if (wasBlocking || blocks) await refillStanding(supabase);
  refresh();

  // Bookings already at that time (they stay booked): warn the stylist.
  const { data: clashes } = await supabase.rpc("calendar_event_clashes", { p_event_id: saved.id });
  const list = (clashes || []).map(
    (c) => `${c.client_name}, ${formatDate(c.booking_date)} at ${clockTime(c.start_time)}`
  );
  const success = id ? "Event saved." : "Event added.";
  if (list.length) {
    const shown = list.slice(0, 5).join("; ");
    const more = list.length > 5 ? ` and ${list.length - 5} more` : "";
    return {
      success,
      savedAt: Date.now(),
      warning: `${list.length === 1 ? "A booking is" : `${list.length} bookings are`} already at this time: ${shown}${more}. ${
        list.length === 1 ? "It stays" : "They stay"
      } booked; move or cancel ${list.length === 1 ? "it" : "them"} if you need to.`,
    };
  }
  return { success, savedAt: Date.now() };
}

// scope "one": skip just this date of a repeating event. "following": end
// the series the day before this date. Otherwise the whole event goes.
export async function deleteEvent(formData) {
  const id = String(formData.get("id") || "");
  const scope = String(formData.get("scope") || "all");
  const date = String(formData.get("date") || "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: event } = await supabase
    .from("calendar_events")
    .select("id, repeats, starts_on, skipped_dates, blocks_bookings")
    .eq("id", id)
    .maybeSingle();
  if (!event) return;

  if (scope === "one" && event.repeats !== "none" && isValidDateString(date)) {
    const skipped = [...new Set([...(event.skipped_dates || []), date])];
    await supabase.from("calendar_events").update({ skipped_dates: skipped }).eq("id", id);
  } else if (scope === "following" && event.repeats !== "none" && isValidDateString(date) && date > event.starts_on) {
    await supabase.from("calendar_events").update({ repeat_until: dayBefore(date) }).eq("id", id);
  } else {
    await supabase.from("calendar_events").delete().eq("id", id);
  }

  if (event.blocks_bookings) {
    await tellWaitlist(user.id);
    await refillStanding(supabase);
  }
  refresh();
}

"use server";

// Personal events on the Calendar: add, edit, delete (one date or all).
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clockTime, formatDate, isValidDateString } from "@/lib/availability";
import { REPEATS } from "@/lib/calendarEvents";
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

export async function saveEvent(prevState, formData) {
  const id = String(formData.get("id") || "");
  const title = String(formData.get("title") || "").trim();
  const startsOn = String(formData.get("starts_on") || "");
  const allDay = formData.get("all_day") === "on";
  const start = String(formData.get("start_time") || "");
  const end = String(formData.get("end_time") || "");
  const repeats = String(formData.get("repeats") || "none");
  const until = String(formData.get("repeat_until") || "");
  const blocks = formData.get("blocks_bookings") === "on";
  const note = String(formData.get("note") || "").trim();

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

  let saved;
  let wasBlocking = false;
  if (id) {
    const { data: before } = await supabase
      .from("calendar_events")
      .select("blocks_bookings")
      .eq("id", id)
      .maybeSingle();
    wasBlocking = Boolean(before?.blocks_bookings);
    const { data, error } = await supabase
      .from("calendar_events")
      .update(row)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return { error: error.code === "42P01" ? NOT_SET_UP : error.message };
    if (!data) return { error: "That event isn't there any more." };
    saved = data;
  } else {
    const { data, error } = await supabase
      .from("calendar_events")
      .insert({ ...row, stylist_id: user.id })
      .select("id")
      .single();
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

// scope "one": skip just this date of a repeating event. Otherwise the
// whole event goes.
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
    .select("id, repeats, skipped_dates, blocks_bookings")
    .eq("id", id)
    .maybeSingle();
  if (!event) return;

  if (scope === "one" && event.repeats !== "none" && isValidDateString(date)) {
    const skipped = [...new Set([...(event.skipped_dates || []), date])];
    await supabase.from("calendar_events").update({ skipped_dates: skipped }).eq("id", id);
  } else {
    await supabase.from("calendar_events").delete().eq("id", id);
  }

  if (event.blocks_bookings) {
    await tellWaitlist(user.id);
    await refillStanding(supabase);
  }
  refresh();
}

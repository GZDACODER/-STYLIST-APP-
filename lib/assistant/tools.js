// The dashboard assistant's tools. Server code only.
//
// Read tools run straight away. Change tools never run on their own: the
// assistant proposes the change, the stylist sees it in plain words and taps
// Confirm, and only then is it made, through the same server actions as the
// dashboard's own buttons (so the same checks and database rules apply).
import { clockTime, formatDate, isValidDateString, parseDateString, toDateString } from "@/lib/availability";
import { REPEATS, eventsOn, repeatLabel } from "@/lib/calendarEvents";
import { holidaysOn } from "@/lib/holidays";
import { formatPrice } from "@/lib/money";
import { saveEvent } from "@/app/(studio)/dashboard/bookings/eventActions";
import { cancelBooking } from "@/app/(studio)/dashboard/bookings/actions";
import { blockDates } from "@/app/(studio)/dashboard/availability/actions";

const DATE = { type: "string", description: "A date as YYYY-MM-DD." };
// A string or null (strict schemas: anyOf, not a type list).
const nullableString = (description) => ({ anyOf: [{ type: "string" }, { type: "null" }], description });
const TIME = nullableString("A time as HH:MM (24-hour), or null.");
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_DAYS = 31;

// ---------- Definitions (sent to Claude) ----------
export const TOOLS = [
  {
    name: "get_schedule",
    description:
      "The stylist's schedule between two dates (at most 31 days): confirmed bookings (with id, client, service, times, deposit), their own calendar events, blocked days, open times posted for booking, weekly working hours, and holidays. Use it before answering questions about the schedule or proposing changes.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { start_date: DATE, end_date: DATE },
      required: ["start_date", "end_date"],
      additionalProperties: false,
    },
  },
  {
    name: "find_client",
    description:
      "Look up clients by name (part of a name works). Returns up to 10 with their status (regular, new, blocked) and next appointment.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "add_calendar_event",
    description:
      "Propose adding an event to the stylist's calendar (a reminder, a personal appointment, or time off for part of a day). Set blocks_bookings to true when clients shouldn't be able to book that time (e.g. 'block off Friday afternoon'). Leave start_time and end_time null for all day. The stylist confirms before it's added.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short name, e.g. 'Blocked', 'Dentist', 'Maya's practice'." },
        date: { ...DATE, description: "The (first) date, YYYY-MM-DD." },
        start_time: TIME,
        end_time: TIME,
        repeats: { type: "string", enum: REPEATS },
        repeat_until: nullableString("Last date for a repeating event (YYYY-MM-DD), or null."),
        blocks_bookings: { type: "boolean" },
        note: nullableString("A short note, or null."),
      },
      required: ["title", "date", "start_time", "end_time", "repeats", "repeat_until", "blocks_bookings", "note"],
      additionalProperties: false,
    },
  },
  {
    name: "block_days",
    description:
      "Propose blocking whole days (vacation, a day off): no bookings on those days. Up to 92 days in a row. The stylist confirms before it's done.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        start_date: DATE,
        end_date: DATE,
        reason: nullableString("Short note only the stylist sees, e.g. 'Vacation', or null."),
      },
      required: ["start_date", "end_date", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "cancel_booking",
    description:
      "Propose cancelling one confirmed booking (use its id from get_schedule). The time opens up again, the client is emailed that it's cancelled, and the waitlist is told; a paid deposit isn't refunded. The stylist confirms before it's cancelled.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { booking_id: { type: "string" } },
      required: ["booking_id"],
      additionalProperties: false,
    },
  },
];

export const CHANGE_TOOLS = new Set(["add_calendar_event", "block_days", "cancel_booking"]);

const hhmm = (t) => (t ? String(t).slice(0, 5) : null);
function addDays(dateText, n) {
  const d = parseDateString(dateText);
  d.setDate(d.getDate() + n);
  return toDateString(d);
}
function daysBetween(a, b) {
  return Math.round((parseDateString(b) - parseDateString(a)) / 86400000);
}

// ---------- Read tools ----------
async function getSchedule(supabase, { start_date, end_date }) {
  if (!isValidDateString(start_date) || !isValidDateString(end_date) || end_date < start_date) {
    return { error: "Give a start_date and end_date as YYYY-MM-DD, end on or after start." };
  }
  if (daysBetween(start_date, end_date) > MAX_DAYS) {
    return { error: `At most ${MAX_DAYS} days at a time. Ask for a shorter range.` };
  }
  const [bookings, events, blocked, openings, hours] = await Promise.all([
    supabase
      .from("bookings")
      .select("id, booking_date, start_time, end_time, service_name, price_cents, client_name, status, deposit_cents, deposit_status, standing_series_id")
      .in("status", ["confirmed", "pending_payment"])
      .gte("booking_date", start_date)
      .lte("booking_date", end_date)
      .order("booking_date")
      .order("start_time")
      .limit(400),
    supabase
      .from("calendar_events")
      .select("*")
      .lte("starts_on", end_date)
      .limit(2000),
    supabase.from("blocked_dates").select("blocked_on, reason").gte("blocked_on", start_date).lte("blocked_on", end_date),
    supabase
      .from("openings")
      .select("opening_date, start_time, end_time, visibility")
      .gte("opening_date", start_date)
      .lte("opening_date", end_date)
      .order("opening_date")
      .order("start_time"),
    supabase.from("working_hours").select("weekday, is_working, start_time, end_time"),
  ]);
  const { data: holidayRows } = await supabase.from("stylist_holiday_settings").select("holiday_key").eq("closed", true);
  const closedKeys = new Set((holidayRows || []).map((r) => r.holiday_key));
  if (bookings.error) return { error: `Couldn't read bookings: ${bookings.error.message}` };

  const days = [];
  for (let date = start_date; date <= end_date; date = addDays(date, 1)) {
    const dayEvents = eventsOn(events.data || [], date).map((e) => ({
      title: e.title,
      time: e.start_time ? `${hhmm(e.start_time)}-${hhmm(e.end_time)}` : "all day",
      blocks_bookings: e.blocks_bookings,
      repeats: e.repeats === "none" ? undefined : repeatLabel(e.repeats, e.starts_on, { days: e.repeat_days || [], mode: e.monthly_mode || "date" }),
      note: e.note || undefined,
    }));
    const holidays = holidaysOn(date).map((h) => (h.key && closedKeys.has(h.key) ? `${h.name} (closed: no bookings)` : h.name));
    if (dayEvents.length || holidays.length) days.push({ date, events: dayEvents, holidays });
  }

  return {
    bookings: (bookings.data || []).map((b) => ({
      id: b.id,
      date: b.booking_date,
      time: `${hhmm(b.start_time)}-${hhmm(b.end_time)}`,
      client: b.client_name,
      service: b.service_name,
      price: formatPrice(b.price_cents),
      status: b.status === "pending_payment" ? "paying deposit now" : "confirmed",
      deposit: b.deposit_cents ? `${formatPrice(b.deposit_cents)} ${b.deposit_status}` : "none",
      standing: Boolean(b.standing_series_id) || undefined,
    })),
    events_and_holidays: days,
    blocked_days: (blocked.data || []).map((r) => ({ date: r.blocked_on, reason: r.reason || undefined })),
    open_times: (openings.data || []).map((o) => ({
      date: o.opening_date,
      time: `${hhmm(o.start_time)}-${hhmm(o.end_time)}`,
      who: o.visibility === "regulars" ? "regulars only" : "everyone",
    })),
    working_hours: (hours.data || []).map((h) => ({
      weekday: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][h.weekday],
      hours: h.is_working ? `${hhmm(h.start_time)}-${hhmm(h.end_time)}` : "off",
    })),
  };
}

async function findClient(supabase, { name }, today) {
  const q = String(name || "").trim().replace(/[%_,()]/g, " ").slice(0, 60);
  if (q.length < 2) return { error: "Give at least 2 letters of the name." };
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, status, phone, email")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(10);
  if (error) return { error: `Couldn't search clients: ${error.message}` };
  const ids = (data || []).map((c) => c.id);
  const { data: next } = ids.length
    ? await supabase
        .from("bookings")
        .select("client_id, booking_date, start_time, service_name")
        .in("client_id", ids)
        .eq("status", "confirmed")
        .gte("booking_date", today)
        .order("booking_date")
        .order("start_time")
    : { data: [] };
  const firstNext = new Map();
  for (const b of next || []) if (!firstNext.has(b.client_id)) firstNext.set(b.client_id, b);
  return {
    clients: (data || []).map((c) => {
      const n = firstNext.get(c.id);
      return {
        name: c.name,
        status: c.status,
        next_appointment: n ? `${n.booking_date} ${hhmm(n.start_time)} ${n.service_name}` : null,
      };
    }),
  };
}

// Runs a read tool. Returns something to send back as the tool result.
export async function runReadTool(supabase, name, input, ctx) {
  if (name === "get_schedule") return getSchedule(supabase, input);
  if (name === "find_client") return findClient(supabase, input, ctx.today);
  return { error: `Unknown tool ${name}.` };
}

// ---------- Change tools: check, describe, then (once confirmed) do ----------
// Returns { summary } for the confirm card, or { error } for Claude to fix.
export async function describeChange(supabase, name, input, ctx) {
  if (name === "add_calendar_event") {
    const { title, date, start_time, end_time, repeats, repeat_until, blocks_bookings } = input;
    if (!String(title || "").trim()) return { error: "The event needs a title." };
    if (!isValidDateString(date)) return { error: "date must be YYYY-MM-DD." };
    if (date < ctx.today) return { error: "That date is in the past." };
    const allDay = !start_time && !end_time;
    if (!allDay) {
      if (!TIME_PATTERN.test(start_time || "") || !TIME_PATTERN.test(end_time || "")) {
        return { error: "start_time and end_time must both be HH:MM, or both null for all day." };
      }
      if (end_time <= start_time) return { error: "end_time must be after start_time." };
    }
    if (repeat_until && (!isValidDateString(repeat_until) || repeat_until < date)) {
      return { error: "repeat_until must be YYYY-MM-DD on or after date." };
    }
    const when = allDay ? `${formatDate(date)}, all day` : `${formatDate(date)}, ${clockTime(start_time)} – ${clockTime(end_time)}`;
    const repeat = repeats && repeats !== "none" ? ` · ${repeatLabel(repeats, date)}${repeat_until ? ` until ${formatDate(repeat_until)}` : ""}` : "";
    return {
      summary: `Add "${String(title).trim()}" to your calendar: ${when}${repeat}. ${
        blocks_bookings ? "Clients can't book this time." : "Just a reminder; clients can still book."
      }`,
    };
  }
  if (name === "block_days") {
    const { start_date, end_date, reason } = input;
    if (!isValidDateString(start_date) || !isValidDateString(end_date) || end_date < start_date) {
      return { error: "start_date and end_date must be YYYY-MM-DD, end on or after start." };
    }
    if (start_date < ctx.today) return { error: "That date is in the past." };
    if (daysBetween(start_date, end_date) > 91) return { error: "At most 92 days at a time." };
    const range = start_date === end_date ? formatDate(start_date) : `${formatDate(start_date)} to ${formatDate(end_date)}`;
    const { count } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("booking_date", start_date)
      .lte("booking_date", end_date);
    return {
      summary: `Block ${range}${reason ? ` (${reason})` : ""}: no new bookings on ${start_date === end_date ? "that day" : "those days"}.${
        count ? ` ${count === 1 ? "1 booking is" : `${count} bookings are`} already on ${start_date === end_date ? "it" : "them"} and will stay.` : ""
      }`,
    };
  }
  if (name === "cancel_booking") {
    const { data: b } = await supabase
      .from("bookings")
      .select("id, client_name, service_name, booking_date, start_time, status, deposit_cents, deposit_status")
      .eq("id", String(input.booking_id || ""))
      .maybeSingle();
    if (!b || b.status !== "confirmed") return { error: "No confirmed booking has that id. Use get_schedule to find it." };
    return {
      summary: `Cancel ${b.client_name}'s ${b.service_name} on ${formatDate(b.booking_date)} at ${clockTime(b.start_time)}. ${b.client_name} is emailed that it's cancelled, the time opens up and your waitlist is told.${
        b.deposit_status === "paid" && b.deposit_cents ? ` Their ${formatPrice(b.deposit_cents)} deposit isn't refunded automatically.` : ""
      }`,
    };
  }
  return { error: `Unknown tool ${name}.` };
}

function form(fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined && v !== null && v !== false) fd.set(k, v === true ? "on" : String(v));
  return fd;
}

// Makes a confirmed change. Returns { ok, message } or { error }.
export async function runChangeTool(supabase, name, input) {
  if (name === "add_calendar_event") {
    const result = await saveEvent(
      null,
      form({
        title: input.title,
        starts_on: input.date,
        all_day: !input.start_time && !input.end_time,
        start_time: input.start_time,
        end_time: input.end_time,
        repeats: input.repeats,
        repeat_until: input.repeat_until,
        blocks_bookings: Boolean(input.blocks_bookings),
        note: input.note,
      })
    );
    if (result?.error) return { error: result.error };
    return { ok: true, message: [result.success, result.warning].filter(Boolean).join(" ") };
  }
  if (name === "block_days") {
    const result = await blockDates(null, form({ start_date: input.start_date, end_date: input.end_date, reason: input.reason }));
    if (result?.error) return { error: result.error };
    return { ok: true, message: result?.success || "Blocked." };
  }
  if (name === "cancel_booking") {
    const id = String(input.booking_id || "");
    await cancelBooking(form({ id }));
    const { data: b } = await supabase.from("bookings").select("status").eq("id", id).maybeSingle();
    if (b?.status !== "cancelled") return { error: "The booking couldn't be cancelled (it may have already changed)." };
    return { ok: true, message: "Booking cancelled. The client has been emailed (if they gave an email), the time is open again and the waitlist has been told." };
  }
  return { error: `Unknown tool ${name}.` };
}

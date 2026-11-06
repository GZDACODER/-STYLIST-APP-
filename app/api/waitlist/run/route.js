// The every-minute waitlist check. Supabase calls this address every minute
// (see supabase/waitlist_every_minute.sql) with the CRON_SECRET, so nobody
// else can set it off.
import { runWaitlist, waitlistConfigured } from "@/lib/waitlist";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPlanReminders } from "@/lib/planReminders";
import { runBookingEmails } from "@/lib/bookingEmails";
import { runWrapups } from "@/lib/wrapupEmails";
import { runWeeklySummaries } from "@/lib/weeklySummary";

export async function POST(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Not allowed", { status: 401 });
  }
  // Add-ons that have lapsed (trial over or not paid): switch off
  // Regulars-only mode and the waitlist. Ignored until the plans SQL is run.
  try {
    if (process.env.SUPABASE_SECRET_KEY) {
      const { error } = await createAdminClient().rpc("plan_apply_limits", {});
      if (error && !/plan_apply_limits/.test(error.message)) {
        console.error("Couldn't apply plan limits", error.message);
      }
    }
  } catch (error) {
    console.error("Couldn't apply plan limits", error);
  }

  // Trial-ending and "plan paused" reminder emails to stylists.
  let reminders = { sent: 0 };
  try {
    reminders = await runPlanReminders();
  } catch (error) {
    console.error("Plan reminders failed", error);
  }

  // Standing appointments roll forward, then confirmation and 24-hour
  // reminder emails to clients.
  let bookingEmails = { held: 0, sent: 0 };
  try {
    bookingEmails = await runBookingEmails();
  } catch (error) {
    console.error("Booking emails failed", error);
  }

  // 8 PM: "How did today go?" to each business with visits to mark.
  let wrapups = { sent: 0 };
  try {
    wrapups = await runWrapups();
  } catch (error) {
    console.error("Wrap-up emails failed", error);
  }

  // Mondays from 8 AM: last week's summary to each business.
  let weekly = { sent: 0 };
  try {
    weekly = await runWeeklySummaries();
  } catch (error) {
    console.error("Weekly summaries failed", error);
  }

  if (!waitlistConfigured()) {
    return Response.json({ skipped: "Email isn't set up yet (see WAITLIST_SETUP.md)." });
  }

  try {
    const result = await runWaitlist(null, new URL(request.url).origin);
    return Response.json({
      ...result,
      planReminders: reminders.sent,
      standingHeld: bookingEmails.held,
      bookingEmails: bookingEmails.sent,
      wrapups: wrapups.sent,
      weeklySummaries: weekly.sent,
    });
  } catch (error) {
    console.error("Waitlist check failed", error);
    return new Response("Waitlist check failed", { status: 500 });
  }
}

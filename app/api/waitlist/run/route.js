// The every-minute waitlist check. Supabase calls this address every minute
// (see supabase/waitlist_every_minute.sql) with the CRON_SECRET, so nobody
// else can set it off.
import { runWaitlist, waitlistConfigured } from "@/lib/waitlist";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPlanReminders } from "@/lib/planReminders";
import { runBookingEmails } from "@/lib/bookingEmails";
import { runWrapups } from "@/lib/wrapupEmails";
import { runWeeklySummaries } from "@/lib/weeklySummary";
import { reportError } from "@/lib/errorAlerts";
import { runOnboardingEmails } from "@/lib/onboardingEmails";
import { runClientEmails } from "@/lib/clientEmails";
import { runOwnerSummary } from "@/lib/ownerSummary";
import { runFollowerAlerts } from "@/lib/followers";

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
        await reportError("Every-minute job", new Error(`Couldn't apply plan limits: ${error.message}`));
      }
    }
  } catch (error) {
    await reportError("Every-minute job", error, { extra: "Couldn't apply plan limits" });
  }

  // Trial-ending and "plan paused" reminder emails to stylists.
  let reminders = { sent: 0 };
  try {
    reminders = await runPlanReminders();
  } catch (error) {
    await reportError("Every-minute job", error, { extra: "Plan reminders failed" });
  }

  // Clients: after-visit emails (aftercare + feedback) and birthday perks.
  let clientEmails = { afterVisit: 0, birthdays: 0 };
  try {
    clientEmails = await runClientEmails();
  } catch (error) {
    await reportError("Every-minute job", error, { extra: "Client emails failed" });
  }

  // The owner's Monday summary.
  try {
    await runOwnerSummary();
  } catch (error) {
    await reportError("Every-minute job", error, { extra: "Owner summary failed" });
  }

  // Getting-started tips for new pros during their trial.
  let onboarding = { sent: 0 };
  try {
    onboarding = await runOnboardingEmails();
  } catch (error) {
    await reportError("Every-minute job", error, { extra: "Getting-started emails failed" });
  }

  // Standing appointments roll forward, then confirmation and 24-hour
  // reminder emails to clients.
  let bookingEmails = { held: 0, sent: 0 };
  try {
    bookingEmails = await runBookingEmails();
  } catch (error) {
    await reportError("Every-minute job", error, { extra: "Booking emails failed" });
  }

  // 8 PM: "How did today go?" to each business with visits to mark.
  let wrapups = { sent: 0 };
  try {
    wrapups = await runWrapups();
  } catch (error) {
    await reportError("Every-minute job", error, { extra: "Wrap-up emails failed" });
  }

  // Mondays from 8 AM: last week's summary to each business.
  let weekly = { sent: 0 };
  try {
    weekly = await runWeeklySummaries();
  } catch (error) {
    await reportError("Every-minute job", error, { extra: "Weekly summaries failed" });
  }

  // Packages (step 68 SQL): count sessions that have started.
  try {
    if (process.env.SUPABASE_SECRET_KEY) {
      const { error } = await createAdminClient().rpc("package_apply_due");
      if (error && !/package_apply_due/.test(error.message)) await reportError("Every-minute job", new Error(`Packages: ${error.message}`));
    }
  } catch (error) {
    await reportError("Every-minute job", error, { extra: "Packages failed" });
  }

  // Opening alerts for clients following a pro's profile (step 60 SQL).
  try {
    await runFollowerAlerts();
  } catch (error) {
    if (!/follower|profile_followers/.test(String(error?.message))) {
      await reportError("Every-minute job", error, { extra: "Opening alerts failed" });
    }
  }

  if (!waitlistConfigured()) {
    return Response.json({ skipped: "Email isn't set up yet (see WAITLIST_SETUP.md)." });
  }

  try {
    const result = await runWaitlist(null, new URL(request.url).origin);
    return Response.json({
      ...result,
      planReminders: reminders.sent,
      onboardingEmails: onboarding.sent,
      afterVisitEmails: clientEmails.afterVisit,
      birthdayEmails: clientEmails.birthdays,
      standingHeld: bookingEmails.held,
      bookingEmails: bookingEmails.sent,
      wrapups: wrapups.sent,
      weeklySummaries: weekly.sent,
    });
  } catch (error) {
    await reportError("Every-minute job", error, { extra: "Waitlist check failed" });
    return new Response("Waitlist check failed", { status: 500 });
  }
}

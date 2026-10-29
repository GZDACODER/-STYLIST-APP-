// The every-minute waitlist check. Supabase calls this address every minute
// (see supabase/waitlist_every_minute.sql) with the CRON_SECRET, so nobody
// else can set it off.
import { runWaitlist, waitlistConfigured } from "@/lib/waitlist";

export async function POST(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Not allowed", { status: 401 });
  }
  if (!waitlistConfigured()) {
    return Response.json({ skipped: "Email isn't set up yet (see WAITLIST_SETUP.md)." });
  }

  try {
    const result = await runWaitlist(null, new URL(request.url).origin);
    return Response.json(result);
  } catch (error) {
    console.error("Waitlist check failed", error);
    return new Response("Waitlist check failed", { status: 500 });
  }
}

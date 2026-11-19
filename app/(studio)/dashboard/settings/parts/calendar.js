// Settings section: Calendar sync (server component). The pro's private
// calendar link, for Google Calendar, iPhone Calendar or Outlook.
import { headers } from "next/headers";
import { publicSiteUrl } from "@/lib/siteUrl";
import CalendarSync from "../CalendarSync";
import { me } from "./common";

export async function CalendarSection() {
  const { supabase, user } = await me("id");
  if (!user) return null;
  const { data: token, error } = await supabase.rpc("my_calendar_feed");
  const host = (await headers()).get("host");
  const site = publicSiteUrl(host ? `https://${host}` : "");
  return (
    <section className="card">
      <p className="muted">
        See your bookings in the calendar you already use. Add this link once, and new bookings, changes and
        cancellations show up there on their own.
      </p>
      {error || !token ? (
        <p className="message info">
          Run <code>supabase/migrations/0048_calendar_feed.sql</code> in Supabase to switch this on.
        </p>
      ) : (
        <CalendarSync feedUrl={`${site}/api/calendar/${token}.ics`} />
      )}
    </section>
  );
}

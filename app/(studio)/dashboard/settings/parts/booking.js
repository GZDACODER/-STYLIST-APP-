// Settings section: BookingPage (server component).
import SettingsForm from "../SettingsForm";
import RescheduleForm from "../RescheduleForm";
import PortfolioForm from "../PortfolioForm";
import CoverPhotoForm from "../CoverPhotoForm";
import BusinessLinksForm from "../BusinessLinksForm";
import { me, optional } from "./common";

export async function BookingPageSection() {
  const { supabase, user, row } = await me("slug");
  if (!user) return null;
  const [tagline, profile, cutoff, portfolio] = await Promise.all([
    optional(supabase, user.id, "tagline"),
    supabase.from("stylists").select("cover_photo_url, instagram, location").eq("id", user.id).maybeSingle(),
    optional(supabase, user.id, "reschedule_cutoff_hours"),
    supabase.from("portfolio_photos").select("id, url, caption, position").order("position").order("created_at"),
  ]);
  const p = profile.data || {};
  return (
    <>
      <section className="card">
        <h2>Link &amp; tagline</h2>
        <SettingsForm part="booking" slug={row.slug} tagline={tagline || ""} />
      </section>
      <section className="card">
        <h2>Photos &amp; links</h2>
        <CoverPhotoForm userId={user.id} coverUrl={p.cover_photo_url || ""} />
        <PortfolioForm photos={portfolio.data || []} ready={!portfolio.error} />
        <BusinessLinksForm instagram={p.instagram || ""} location={p.location || ""} />
      </section>
      <section className="card">
        <h2>Rescheduling</h2>
        <p className="muted">
          Clients can move their own appointment to another open time, from your booking page or the
          Reschedule link in their emails.
        </p>
        <RescheduleForm cutoffHours={cutoff ?? 24} />
      </section>
    </>
  );
}

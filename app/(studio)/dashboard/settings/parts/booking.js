// Settings section: BookingPage (server component).
import SettingsForm from "../SettingsForm";
import RescheduleForm from "../RescheduleForm";
import PortfolioForm from "../PortfolioForm";
import CoverPhotoForm from "../CoverPhotoForm";
import BusinessLinksForm from "../BusinessLinksForm";
import LogoForm from "../LogoForm";
import { me, optional } from "./common";
import ProCode from "@/components/dash/ProCode";

export async function BookingPageSection() {
  const { supabase, user, row } = await me("slug");
  if (!user) return null;
  const [tagline, profile, cutoff, portfolio, proCode] = await Promise.all([
    optional(supabase, user.id, "tagline"),
    supabase.from("stylists").select("cover_photo_url, logo_url, accent_color, instagram, location, tiktok, website, facebook, contact_phone, contact_email, show_map").eq("id", user.id).maybeSingle(),
    optional(supabase, user.id, "reschedule_cutoff_hours"),
    supabase.from("portfolio_photos").select("id, url, caption, position").order("position").order("created_at"),
    optional(supabase, user.id, "pro_code"),
  ]);
  const p = profile.data || {};
  return (
    <>
      {proCode && (
        <section className="card">
          <ProCode code={proCode} />
        </section>
      )}
      <section className="card">
        <h2>Link &amp; tagline</h2>
        <SettingsForm part="booking" slug={row.slug} tagline={tagline || ""} />
      </section>
      <section className="card">
        <h2>Photos &amp; links</h2>
        <CoverPhotoForm userId={user.id} coverUrl={p.cover_photo_url || ""} />
        <LogoForm logoUrl={p.logo_url || ""} accent={p.accent_color || ""} />
        <PortfolioForm photos={portfolio.data || []} ready={!portfolio.error} />
        <BusinessLinksForm
          instagram={p.instagram || ""}
          location={p.location || ""}
          tiktok={p.tiktok || ""}
          facebook={p.facebook || ""}
          website={p.website || ""}
          phone={p.contact_phone || ""}
          email={p.contact_email || ""}
          showMap={Boolean(p.show_map)}
        />
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

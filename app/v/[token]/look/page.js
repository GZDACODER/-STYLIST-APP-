// "Can I show your look?": the client sees the photo and says yes or no to
// it appearing on the pro's public profile (step 61 SQL). From the link in
// the email the pro sends; the link is the booking's own secret code.
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOKEN_RE } from "@/lib/manageLink";
import { displayName } from "@/lib/bookingHeader";
import { formatDate } from "@/lib/availability";
import LookConsent from "./LookConsent";

export const metadata = { title: "Your look", robots: { index: false, follow: false } };

export default async function LookPage({ params }) {
  const { token } = await params;
  if (!TOKEN_RE.test(token)) notFound();
  const admin = createAdminClient();
  const { data: b } = await admin
    .from("bookings")
    .select("service_name, booking_date, look_photo_path, look_consent, stylist:stylists(business_name, handle, profile_on)")
    .eq("cancel_token", token)
    .maybeSingle();
  if (!b?.stylist) notFound();
  // The pro removed or replaced the photo since they asked.
  if (!b.look_photo_path)
    return (
      <section className="card">
        <h1>This photo isn&apos;t shared any more</h1>
        <p>
          {displayName(b.stylist.business_name)} has removed or replaced it, so there&apos;s nothing to answer. If they
          share a new one and want to show it, they&apos;ll ask you again.
        </p>
      </section>
    );
  const { data } = await admin.storage.from("client-looks").createSignedUrl(b.look_photo_path, 3600);
  const name = displayName(b.stylist.business_name);
  return (
    <section className="card">
      <h1>Can {name} share your look?</h1>
      <p className="muted small-text">
        {b.service_name} · {formatDate(b.booking_date)}
      </p>
      {data?.signedUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.signedUrl} alt={`Your ${b.service_name}`} className="lk-photo" />
      )}
      <p>
        {name} would like to show this photo of your {b.service_name.toLowerCase()} on their public profile
        {b.stylist.handle ? ` (clientelesuite.com/p/${b.stylist.handle})` : ""}. Your name is never shown with it.
      </p>
      <LookConsent token={token} initial={b.look_consent} proName={name} />
    </section>
  );
}

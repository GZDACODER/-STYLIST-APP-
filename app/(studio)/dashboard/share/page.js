// Share kit: everything a pro needs to get their booking link out there:
// the link, a QR code, an Instagram story image, a printable card for the
// station, and messages ready to copy.
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { publicSiteUrl } from "@/lib/siteUrl";
import { BRAND_NAME } from "@/lib/brand";
import PageHeader from "@/components/dash/PageHeader";
import CopyLinkButton from "@/components/dash/CopyLinkButton";
import ShareLinkButton from "../ShareLinkButton";

export const metadata = { title: `Share kit · ${BRAND_NAME}` };

export default async function ShareKitPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: stylist } = await supabase.from("stylists").select("slug, business_name").eq("id", user.id).maybeSingle();
  const { data: codeRow } = await supabase.from("stylists").select("pro_code").eq("id", user.id).maybeSingle();
  const proCode = codeRow?.pro_code || null;
  if (!stylist) redirect("/dashboard");

  const host = (await headers()).get("host");
  const site = publicSiteUrl(host ? `https://${host}` : "");
  const link = `${site}/book/${stylist.slug}`;
  const kit = (kind) => `/book/${stylist.slug}/kit/${kind}`;

  const messages = [
    {
      title: "Instagram or TikTok bio",
      text: `Book online ↓\n${link}`,
      how: "Instagram: Edit profile → Links → Add external link. TikTok: Edit profile → Website.",
    },
    {
      title: "Text to your regulars",
      text: `Hi! I've moved my booking online. You can see my open times and book your next appointment here: ${link}`,
    },
    ...(proCode
      ? [
          {
            title: "How clients sign in",
            text: `To see your visits, book your usual or tell me you're running late, sign in at ${site}/client with my ID ${proCode} and your phone number.`,
          },
        ]
      : []),
    {
      title: "Reply to a DM about times",
      text: `Thanks for reaching out! You can see all my open times and book here: ${link}`,
    },
    {
      title: "Google (Maps and Search)",
      text: link,
      how: "Google Business Profile → Edit profile → Contact → Appointment links → paste the link. Clients get a Book button on Google.",
    },
  ];

  return (
    <>
      <PageHeader guide="share" title="Share kit" subtitle="Get your booking link in front of clients." />

      <section className="card stack">
        <h2>Your booking link</h2>
        <p className="share-link">{link.replace(/^https?:\/\//, "")}</p>
        <div className="row wrap share-buttons">
          <ShareLinkButton link={link} businessName={stylist.business_name} />
          <CopyLinkButton link={link} />
        </div>
      </section>

      <section className="card stack">
        <h2>Pictures to post and print</h2>
        <div className="share-kit-grid">
          <figure className="share-kit-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={kit("story")} alt="Instagram story with your name and QR code" width={1080} height={1920} loading="lazy" />
            <figcaption>
              <strong>Instagram story</strong>
              <span className="muted small-text">Post it, then add a Link sticker with your booking link.</span>
              <a className="button small" href={`${kit("story")}?download=1`} download>
                Save picture
              </a>
            </figcaption>
          </figure>
          <figure className="share-kit-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={kit("card")} alt="Printable card: Scan to book" width={1500} height={2100} loading="lazy" />
            <figcaption>
              <strong>Card for your station</strong>
              <span className="muted small-text">Print it 5 × 7 (or 4 × 6) for your mirror or front desk.</span>
              <a className="button small" href={`${kit("card")}?download=1`} download>
                Save picture
              </a>
            </figcaption>
          </figure>
          <figure className="share-kit-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={kit("qr")} alt="QR code for your booking link" width={1024} height={1024} loading="lazy" className="is-square" />
            <figcaption>
              <strong>QR code</strong>
              <span className="muted small-text">For business cards, flyers or your own designs.</span>
              <a className="button small" href={`${kit("qr")}?download=1`} download>
                Save QR code
              </a>
            </figcaption>
          </figure>
        </div>
        <p className="muted small-text">
          On iPhone: tap Save picture, then the share button → Save Image, and it&apos;s in your Photos. Your cover photo
          (Settings → Booking page) is used behind the story when you have one.
        </p>
      </section>

      <section className="card stack">
        <h2>Ready-to-send messages</h2>
        <ul className="share-messages">
          {messages.map((m) => (
            <li key={m.title}>
              <div className="share-message-head">
                <strong>{m.title}</strong>
                <CopyLinkButton link={m.text} label="Copy" />
              </div>
              <p className="share-message-text">{m.text}</p>
              {m.how && <p className="muted small-text">{m.how}</p>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

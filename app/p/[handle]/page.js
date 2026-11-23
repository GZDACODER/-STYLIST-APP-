// A pro's public profile: who they are, their work, services and prices,
// policies, hours and next open times, with a button to their booking page.
// Only shown when the pro has switched it on (Settings > Public profile);
// the pro can preview it before that.
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadProfile } from "@/lib/publicProfile";
import { displayName } from "@/lib/bookingHeader";
import { formatPrice } from "@/lib/money";
import { BRAND_NAME } from "@/lib/brand";
import Portfolio from "@/app/book/[slug]/Portfolio";
import Reviews from "../Reviews";

async function viewerId() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const { handle } = await params;
  const p = await loadProfile(handle, await viewerId());
  if (!p) return { title: `Profile not found · ${BRAND_NAME}`, robots: { index: false } };
  const name = displayName(p.name);
  const title = `${name} · ${p.type}${p.city ? ` in ${p.city}` : ""}`;
  const description = (p.bio || `${p.type}${p.city ? ` in ${p.city}` : ""}. See their work and book online.`).slice(0, 200);
  return {
    title,
    description,
    alternates: { canonical: `/p/${p.handle}` },
    robots: p.preview ? { index: false, follow: false } : undefined,
    openGraph: { title, description, siteName: BRAND_NAME, type: "profile", url: `/p/${p.handle}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

const length = (m) => {
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h && r ? `${h} hr ${r} min` : h ? `${h} hr` : `${r} min`;
};
const dayLabel = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export default async function ProfilePage({ params }) {
  const { handle } = await params;
  const p = await loadProfile(handle, await viewerId());
  if (!p) notFound();
  const name = displayName(p.name);
  const bookHref = `/book/${p.slug}`;
  const facts = [p.type, p.city, p.years ? `${p.years} ${p.years === 1 ? "year" : "years"} in business` : null].filter(Boolean);

  return (
    <main className="bk-main pp">
      {p.preview && (
        <p className="message info pp-preview">
          <strong>Preview.</strong> Only you can see this. Switch your profile on in{" "}
          <Link href="/dashboard/settings/profile">Settings › Public profile</Link> to publish it.
        </p>
      )}

      <header className="pp-head">
        {p.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pp-photo" src={p.photo} alt="" fetchPriority="high" decoding="async" />
        ) : (
          <div className="pp-photo pp-photo-blank" aria-hidden="true">
            {name.slice(0, 1)}
          </div>
        )}
        <div className="pp-id">
          <p className="pp-kicker">{facts.join(" · ")}</p>
          <h1 className="pp-name">{name}</h1>
          {p.owner && <p className="pp-owner">by {p.owner}</p>}
          {p.show.reviews && p.reviews?.total > 0 && (
            <a className="pp-head-rating" href="#reviews">
              <span className="pp-stars">★</span> {p.reviews.average.toFixed(1)} · {p.reviews.total}{" "}
              {p.reviews.total === 1 ? "rating" : "ratings"}
            </a>
          )}
        </div>
      </header>

      {p.bio && <p className="pp-bio">{p.bio}</p>}

      {p.specialties.length > 0 && (
        <ul className="pp-tags" aria-label="Specialties">
          {p.specialties.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}

      {(p.links.instagram || p.links.tiktok || p.links.website) && (
        <nav className="pp-links" aria-label={`${name} elsewhere`}>
          {p.links.instagram && (
            <a href={p.links.instagram} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          )}
          {p.links.tiktok && (
            <a href={p.links.tiktok} target="_blank" rel="noopener noreferrer">
              TikTok
            </a>
          )}
          {p.links.website && (
            <a href={p.links.website} target="_blank" rel="noopener noreferrer">
              Website
            </a>
          )}
        </nav>
      )}

      <section className="pp-book card">
        {p.regularsOnly ? (
          <>
            <h2>Booking is for regulars right now</h2>
            <p className="muted small-text">
              {name} is only taking {p.words.appointments} with regulars at the moment.
              {p.waitlist ? " You can join the waitlist on their booking page to hear about openings." : ""}
            </p>
            <div className="pp-actions">
              <Link className="button" href={bookHref}>
                Open booking page
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2>Book with {name}</h2>
            {p.show.openings && p.openings.length > 0 && (
              <>
                <p className="muted small-text">Next open times</p>
                <ul className="pp-times">
                  {p.openings.map((o) => (
                    <li key={`${o.date}${o.time}`}>
                      <Link href={bookHref}>
                        <span>{dayLabel(o.date)}</span>
                        <strong>{o.label}</strong>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {p.show.openings && p.openings.length === 0 && p.services.length > 0 && (
              <p className="muted small-text">No open times in the next few weeks. Check the booking page for the latest.</p>
            )}
            <div className="pp-actions">
              <Link className="button" href={bookHref}>
                See availability
              </Link>
            </div>
          </>
        )}
      </section>

      {p.show.reviews && <Reviews reviews={p.reviews} handle={p.handle} name={name} />}

      {p.show.portfolio && p.portfolio.length > 0 && <Portfolio photos={p.portfolio} name={name} />}

      {p.services.length > 0 && (
        <section className="card">
          <h2>{p.servicesTitle}</h2>
          <ul className="pp-services">
            {p.services.map((s) => (
              <li key={s.id}>
                <Link href={`${bookHref}?service=${s.id}`}>
                  <span className="pp-svc-name">{s.name}</span>
                  <span className="pp-svc-meta">
                    {length(s.minutes)}
                    {p.show.prices && <> · {s.price_cents ? formatPrice(s.price_cents) : "Free"}</>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(p.depositNote || p.cancellation) && (
        <section className="card">
          <h2>Policies</h2>
          {p.depositNote && <p className="small-text">{p.depositNote}</p>}
          {p.cancellation && <p className="small-text pp-policy">{p.cancellation}</p>}
        </section>
      )}

      {p.show.hours && p.hours.some((h) => h.open) && (
        <section className="card">
          <h2>Hours</h2>
          <dl className="pp-hours">
            {p.hours.map((h) => (
              <div key={h.day} className={h.open ? "" : "closed"}>
                <dt>{h.day}</dt>
                <dd>{h.text}</dd>
              </div>
            ))}
          </dl>
          <p className="muted small-text">Times are in {p.timezone?.replace(/_/g, " ").split("/").pop()} time.</p>
        </section>
      )}
    </main>
  );
}

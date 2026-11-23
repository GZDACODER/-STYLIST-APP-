// Find a pro: search by business name, owner's name or Pro ID, and filter by
// type and city. Only pros who've switched on "Show me in search" appear.
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { displayName } from "@/lib/bookingHeader";
import { SEARCH_TYPES, searchCities, searchPros } from "@/lib/search";

export const metadata = {
  title: `Find your pro · ${BRAND_NAME}`,
  description: "Search for your stylist, barber, tattoo artist or tutor by name or Pro ID, see their work and reviews, and book.",
  alternates: { canonical: "/find" },
};

const dayLabel = (iso) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

export default async function FindPage({ searchParams }) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const type = typeof sp.type === "string" ? sp.type : "";
  const city = typeof sp.city === "string" ? sp.city : "";
  const searched = Boolean(q || type || city);
  const [cities, { results, limited, error }] = await Promise.all([
    searchCities(),
    searched ? searchPros({ q, type, city }) : Promise.resolve({ results: [], limited: false }),
  ]);

  return (
    <main className="bk-main pp fd">
      <p className="pp-kicker">{BRAND_NAME}</p>
      <h1 className="pp-name">Find your pro</h1>
      <p className="muted">Search by business name, your pro&apos;s name, or their Pro ID (like CL-AB2C).</p>

      <form className="fd-form" action="/find" method="get" role="search">
        <label className="visually-hidden" htmlFor="fd-q">
          Name or Pro ID
        </label>
        <input id="fd-q" name="q" type="search" defaultValue={q} placeholder="Name or Pro ID" maxLength={80} autoComplete="off" enterKeyHint="search" />
        <div className="fd-filters">
          <label>
            <span className="visually-hidden">Type</span>
            <select name="type" defaultValue={type}>
              {SEARCH_TYPES.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="visually-hidden">City or area</span>
            <select name="city" defaultValue={city}>
              <option value="">Any city or area</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" className="button">
          Search
        </button>
      </form>

      {limited && <p className="message error">Too many searches. Please try again in a little while.</p>}
      {error && <p className="message error">Search isn&apos;t working right now. Please try again.</p>}

      {searched && !limited && !error && (
        <section aria-live="polite">
          <p className="muted small-text fd-count">
            {results.length ? `${results.length} ${results.length === 1 ? "pro" : "pros"}` : "No pros found"}
            {q ? ` for “${q}”` : ""}
          </p>
          {results.length === 0 && (
            <p className="small-text">
              Check the spelling, or ask your pro for their Pro ID or profile link. Only pros who&apos;ve chosen to be
              found show up here.
            </p>
          )}
          <ul className="fd-results">
            {results.map((r) => {
              const name = displayName(r.name);
              return (
                <li key={r.handle}>
                  <Link href={`/p/${r.handle}`} className="fd-card">
                    {r.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="fd-photo" src={r.photo} alt="" loading="lazy" decoding="async" />
                    ) : (
                      <span className="fd-photo pp-photo-blank" aria-hidden="true">
                        {name.slice(0, 1)}
                      </span>
                    )}
                    <span className="fd-body">
                      <span className="fd-name">{name}</span>
                      <span className="fd-meta">
                        {[r.type, r.city, r.owner ? `by ${r.owner}` : null].filter(Boolean).join(" · ")}
                      </span>
                      {r.rating && (
                        <span className="fd-meta">
                          <span className="pp-stars">★</span> {r.rating.average.toFixed(1)} ({r.rating.count}{" "}
                          {r.rating.count === 1 ? "rating" : "ratings"})
                        </span>
                      )}
                      <span className="fd-next">
                        {r.regularsOnly
                          ? "Booking is for regulars right now"
                          : r.next
                            ? `Next opening: ${dayLabel(r.next.date)}, ${r.next.label}`
                            : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="muted small-text fd-pro">
        Are you a pro? <Link href="/dashboard/settings/profile">Turn on your public profile</Link> and choose “Show me
        in search”.
      </p>
    </main>
  );
}

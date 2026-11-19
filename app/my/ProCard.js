// One pro on My Pros: their photo and name, a deposit still to pay, the
// next appointment (with Reschedule or cancel), their standing visits, any
// waitlist they're on, the last visit, and Book again.
import Link from "next/link";
import { clockTime } from "@/lib/availability";
import { displayName } from "@/lib/bookingHeader";
import RegularStar from "@/components/RegularStar";
import { formatPrice } from "@/lib/money";
import { describeWishes } from "@/lib/preferences";

// "Tue, Nov 24" (the year only when it isn't this year).
function shortDate(text) {
  const [y, m, d] = String(text).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(y !== new Date().getFullYear() && { year: "numeric" }),
  });
}

// "Oct 20" / "Oct 20, 2025".
function monthDay(text) {
  const [y, m, d] = String(text).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(y !== new Date().getFullYear() && { year: "numeric" }),
  });
}

const https = (url) => (typeof url === "string" && /^https:\/\//.test(url) ? url : null);

// extras: this pro's rows from get_my_pro_extras (step 40 SQL): deposits to
// pay, standing visits and waitlists. A pro they're only waitlisted with has
// no next or last visit, just the waitlist and Book.
export default function ProCard({ pro, extras = [] }) {
  const name = displayName(pro.business_name);
  const deposits = extras.filter((x) => x.kind === "deposit");
  const standing = extras.filter((x) => x.kind === "standing");
  const waits = extras.filter((x) => x.kind === "waitlist");
  const photo = https(pro.cover_photo_url);
  const page = `/book/${pro.slug}`;
  const more = (pro.upcoming_count || 0) - 1;
  return (
    <li className="my-pro">
      <div className="my-pro-head">
        {photo ? (
          <img className="my-pro-photo" src={photo} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="my-pro-photo my-pro-initial" aria-hidden="true">
            {name.trim().charAt(0).toUpperCase()}
          </span>
        )}
        <div className="my-pro-title">
          <h2>{name}</h2>
          {pro.viewer_status === "regular" && (
            <span className="my-pro-regular">
              <RegularStar label={null} size={11} /> Regular
            </span>
          )}
        </div>
      </div>

      {deposits.slice(0, 1).map((d) => (
        <div key={d.token} className="my-pro-due">
          <span className="my-pro-label">Deposit due</span>
          <p>
            <strong>{formatPrice(d.amount_cents)}</strong> for {d.label} on {shortDate(d.item_date)} at{" "}
            {clockTime(d.item_time)}
          </p>
          <Link href={`${page}/pay?t=${encodeURIComponent(d.token)}`} className="button small">
            Pay {formatPrice(d.amount_cents)} deposit
          </Link>
          {deposits.length > 1 && (
            <p className="muted small-text">
              {deposits.length - 1} more {deposits.length === 2 ? "deposit" : "deposits"} for later visits. Each one
              shows here when it&apos;s next.
            </p>
          )}
        </div>
      ))}

      {pro.next_date ? (
        <div className="my-pro-next">
          <span className="my-pro-label">Next</span>
          <p>
            <strong>
              {shortDate(pro.next_date)} · {clockTime(pro.next_start)}
            </strong>
            <br />
            {pro.next_service}
            {more > 0 && <span className="muted"> · and {more} more</span>}
          </p>
          <Link href={page} className="my-pro-manage">
            Reschedule or cancel
          </Link>
        </div>
      ) : null}

      {standing.length > 0 && (
        <div className="my-pro-standing">
          <span className="my-pro-label">
            Standing · every {standing[0].repeat_weeks} weeks · {standing[0].label}
          </span>
          <ul>
            {standing.map((v) => (
              <li key={`${v.item_date}-${v.item_time}`}>
                {shortDate(v.item_date)} · {clockTime(v.item_time)}
              </li>
            ))}
          </ul>
          <p className="muted small-text">Held for you. To skip or move one, use Reschedule or cancel, or ask {name}.</p>
        </div>
      )}

      {waits.map((w) => (
        <div key={w.token} className="my-pro-wait">
          <span className="my-pro-label">On the waitlist</span>
          <p>
            {w.label} · {describeWishes(w.days || [], w.times || [])}
          </p>
          <Link href={`${page}/waitlist?t=${encodeURIComponent(w.token)}`} className="my-pro-manage">
            See or leave the waitlist
          </Link>
        </div>
      ))}

      {pro.last_date && (
        <p className="my-pro-last muted small-text">
          Last visit: {pro.last_service_name}, {monthDay(pro.last_date)}
          {pro.visits > 1 && ` · ${pro.visits} visits`}
        </p>
      )}

      <div className="my-pro-actions">
        {pro.last_service_id ? (
          <>
            <Link href={`${page}?service=${pro.last_service_id}`} className="button">
              Book {pro.last_service_name} again
            </Link>
            <Link href={page} className="link-button">
              Something else
            </Link>
          </>
        ) : (
          <Link href={page} className="button">
            Book
          </Link>
        )}
      </div>
    </li>
  );
}

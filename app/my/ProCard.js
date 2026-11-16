// One pro on My Pros: their photo and name, the next appointment (with
// Reschedule or cancel), the last visit, and Book again.
import Link from "next/link";
import { clockTime } from "@/lib/availability";
import { displayName } from "@/lib/bookingHeader";
import RegularStar from "@/components/RegularStar";

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

export default function ProCard({ pro }) {
  const name = displayName(pro.business_name);
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

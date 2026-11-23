// Ratings and approved reviews on a public profile.
import Link from "next/link";
import { stars } from "@/lib/reviews";
import ReportReview from "./ReportReview";

const day = (iso) => new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });

export default function Reviews({ reviews, handle, limit = 5, name }) {
  if (!reviews?.total) return null;
  const list = reviews.list.slice(0, limit);
  return (
    <section className="card pp-reviews" id="reviews">
      <h2>Reviews</h2>
      <div className="pp-rating">
        <p className="pp-rating-big">
          {reviews.average.toFixed(1)}
          <span className="pp-stars" aria-label={`${reviews.average.toFixed(1)} out of 5 stars`}>
            {stars(reviews.average)}
          </span>
        </p>
        <p className="muted small-text">
          {reviews.total} {reviews.total === 1 ? "rating" : "ratings"} from clients after a real visit
        </p>
        <ul className="pp-bars" aria-label="Ratings by stars">
          {[5, 4, 3, 2, 1].map((n) => (
            <li key={n}>
              <span>{n}★</span>
              <span className="pp-bar">
                <span style={{ width: `${reviews.total ? (reviews.counts[n] / reviews.total) * 100 : 0}%` }} />
              </span>
              <span className="pp-bar-n">{reviews.counts[n]}</span>
            </li>
          ))}
        </ul>
      </div>
      {list.length > 0 && (
        <ul className="pp-review-list">
          {list.map((r) => (
            <li key={r.id}>
              <p className="pp-review-head">
                <span className="pp-stars" aria-label={`${r.rating} out of 5 stars`}>
                  {stars(r.rating)}
                </span>
                <span className="muted small-text">
                  {r.name} · {r.service} · {day(r.date)}
                </span>
              </p>
              <p className="pp-review-text">{r.comment}</p>
              {r.reply && (
                <p className="pp-review-reply small-text">
                  <strong>Reply from {name}:</strong> {r.reply}
                </p>
              )}
              <ReportReview id={r.id} />
            </li>
          ))}
        </ul>
      )}
      {reviews.list.length > limit && (
        <p>
          <Link href={`/p/${handle}/reviews`}>See all {reviews.writtenCount} reviews</Link>
        </p>
      )}
    </section>
  );
}

// /client/rate?t=<visit token>&r=<1-5>: one-tap feedback from the
// after-visit email. The rating is saved by the page in the browser (not by
// opening the link), so email link scanners can't leave a rating.
import RateVisit from "./RateVisit";

export const metadata = { title: "How was your visit? · Clientele", robots: { index: false } };

export default async function RatePage({ searchParams }) {
  const { t, r } = await searchParams;
  const token = /^[0-9a-f]{64}$/.test(String(t || "")) ? String(t) : null;
  const rating = Math.min(5, Math.max(1, Number(r) || 0)) || null;
  return (
    <div className="cl-signin">
      <header className="cl-head">
        <p className="bk-kicker">Your visit</p>
        <h1 className="cl-title">Thank you</h1>
      </header>
      {token ? <RateVisit token={token} initial={rating} /> : <p className="message error">This link doesn&apos;t work.</p>}
    </div>
  );
}

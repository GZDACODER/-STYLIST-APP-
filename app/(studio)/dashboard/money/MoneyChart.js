// Earnings by day or month as simple bars (drawn here, no chart library).
import { formatPrice } from "@/lib/money";

export default function MoneyChart({ series, today }) {
  if (!series?.length) return null;
  const max = Math.max(1, ...series.map((s) => s.cents));
  const W = 100 / series.length;
  return (
    <figure className="mn-chart" aria-label="Earnings chart">
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-hidden="true">
        {series.map((s, i) => {
          const h = (s.cents / max) * 36;
          const future = s.from > today;
          return <rect key={s.from} x={i * W + W * 0.15} y={38 - h} width={W * 0.7} height={Math.max(h, s.cents ? 0.6 : 0)} className={future ? "mn-bar future" : "mn-bar"} />;
        })}
        <line x1="0" y1="38.2" x2="100" y2="38.2" className="mn-axis" />
      </svg>
      <div className="mn-labels" style={{ gridTemplateColumns: `repeat(${series.length}, 1fr)` }}>
        {series.map((s, i) => (
          <span key={s.from} title={`${s.label}: ${formatPrice(s.cents)}`}>
            {series.length > 14 ? (i % 5 === 0 || i === series.length - 1 ? s.label : "") : s.label}
          </span>
        ))}
      </div>
      <figcaption className="visually-hidden">
        {series.map((s) => `${s.label}: ${formatPrice(s.cents)}`).join(", ")}
      </figcaption>
    </figure>
  );
}

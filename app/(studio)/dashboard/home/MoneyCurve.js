"use client";

// Home > This month: what's been earned so far (Money's earnings figure),
// drawn as a running total over last month's (dotted), with the change
// against last month by the same day. Hover, focus or tap a day for both
// months' totals on that day.
import { useState } from "react";
import Link from "next/link";
import { ExampleTag } from "@/components/dash/Example";
import { useCountUp, useEntrance } from "./useEntrance";

const W = 320;
const H = 120;
const PAD = 6;
const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round((cents || 0) / 100));

export default function MoneyCurve({ month, today, moneyHref = "/dashboard/money" }) {
  const mode = useEntrance(today);
  const shown = useCountUp(Math.round(month.total / 100), mode === "play");
  const [tip, setTip] = useState(null);

  const daysInView = Math.max(month.lastPoints.length, 28, month.points.length);
  const top = Math.max(1, month.lastTotal, month.total);
  const x = (day) => PAD + ((day - 1) / Math.max(1, daysInView - 1)) * (W - PAD * 2);
  const y = (cum) => H - PAD - (cum / top) * (H - PAD * 2);
  const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${x(p.day).toFixed(1)},${y(p.cum).toFixed(1)}`).join(" ");

  const tipPoint = tip === null ? null : month.points[tip];
  const lastOn = (day) => month.lastPoints[Math.min(day, month.lastPoints.length) - 1];
  const tipText = (p) => {
    const last = lastOn(p.day);
    return `${month.label.slice(0, 3)} ${p.day} · ${money(p.cum)} so far${last ? ` (${month.lastLabel.slice(0, 3)} ${Math.min(p.day, month.lastPoints.length)}: ${money(last.cum)})` : ""}`;
  };

  return (
    <section className={`card hf-card hf-month${mode === "play" ? " is-play" : ""}`} aria-label="This month">
      <div className="hf-card-head">
        <h2>{month.label}</h2>
        {month.examples ? <ExampleTag /> : <Link href={moneyHref} className="small-text">Money →</Link>}
      </div>
      <p className="hf-figure">
        ${shown.toLocaleString("en-US")}
        {month.changePct !== null && (
          <span className={month.changePct >= 0 ? "hf-chip is-up" : "hf-chip"}>
            {month.changePct >= 0 ? "↑" : "↓"} {Math.abs(month.changePct)}%
          </span>
        )}
      </p>
      <p className="hf-sub hf-sub-tight">Earned in {month.label}</p>
      <svg className="hf-curve" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Earned so far: ${money(month.total)}. ${month.lastLabel}: ${money(month.lastTotal)} in all.`} onMouseLeave={() => setTip(null)}>
        {month.lastPoints.length > 1 && <path className="hf-curve-last" d={path(month.lastPoints)} />}
        {month.points.length > 1 && <path className="hf-curve-this" d={path(month.points)} pathLength="1" />}
        {month.points.map((p, i) => (
          <circle
            key={p.day}
            className={tip === i ? "hf-dot is-tip" : "hf-dot"}
            cx={x(p.day)}
            cy={y(p.cum)}
            r={4}
            tabIndex={0}
            role="button"
            aria-label={tipText(p)}
            onMouseEnter={() => setTip(i)}
            onFocus={() => setTip(i)}
            onClick={() => setTip(i)}
          />
        ))}
      </svg>
      <p className="hf-tip" aria-live="polite">
        {tipPoint ? tipText(tipPoint) : " "}
      </p>
      <p className="hf-sub">
        {month.passedLastMonth
          ? `Best month yet vs ${month.lastLabel}.`
          : month.ahead && month.changePct !== null
            ? `Ahead of ${month.lastLabel}.`
            : month.changePct !== null
              ? `${month.lastLabel} by now: ${money(month.lastSameDays)}.`
              : " "}
        {month.depositsCents > 0 && <span className="hf-deposits"> {money(month.depositsCents)} paid online as deposits.</span>}
      </p>
    </section>
  );
}

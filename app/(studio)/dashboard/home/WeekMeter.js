"use client";

// Home > This week: how full the week is (booked minutes against the
// openings' minutes), a bar per day, Mon to Sun. Hover or tap a bar for
// its numbers; tap it again to open the calendar.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExampleTag } from "@/components/dash/Example";
import { useCountUp, useEntrance } from "./useEntrance";

// Minutes → "6", "6.5" hours (nearest half hour).
const hours = (m) => {
  const h = Math.round((m / 60) * 2) / 2;
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
};

export default function WeekMeter({ week, today, calendarHref = "/dashboard/bookings" }) {
  const router = useRouter();
  const mode = useEntrance(today);
  const pct = useCountUp(week.pct, mode === "play");
  const [tip, setTip] = useState(null);
  // Touch: the first tap shows a day's numbers, a second tap on the same day
  // opens the calendar. Mouse (hover already shows them) and keyboard open it
  // straight away. Focus alone never "arms" the second tap.
  const pointer = useRef(null);
  const tapped = useRef(null);
  const pick = (i) => {
    if (pointer.current === "touch" || pointer.current === "pen") {
      if (tapped.current === i) return router.push(calendarHref);
      tapped.current = i;
      return setTip(i);
    }
    router.push(calendarHref);
  };
  const full = week.pct >= 100 && week.offeredMin > 0;
  const none = week.offeredMin === 0 && week.bookedMin === 0;
  const tipDay = tip === null ? null : week.days[tip];
  const dayText = (d) =>
    `${d.label}, ${d.bookedCount} booked${d.hasOpenings ? `, ${hours(Math.max(0, d.offeredMin - d.bookedMin))} hours open` : ", no open times"}`;

  return (
    <section className={`card hf-card hf-week${mode === "play" ? " is-play" : ""}${full ? " is-full" : ""}`} aria-label="This week">
      <div className="hf-card-head">
        <h2>This week</h2>
        {week.examples && <ExampleTag />}
      </div>
      <p className="hf-figure">
        {pct}%<span className="hf-figure-unit">booked</span>
      </p>
      <div className="hf-bars" role="group" aria-label="Each day this week" onMouseLeave={() => setTip(null)}>
        {week.days.map((d, i) => (
          <button
            key={d.date}
            type="button"
            className={`hf-bar${d.past ? " is-past" : ""}${d.isToday ? " is-today" : ""}${d.hasOpenings ? "" : " is-empty"}${tip === i ? " is-tip" : ""}`}
            style={{ "--h": `${d.hasOpenings || d.bookedMin ? Math.max(d.pct, 4) : 0}%`, "--i": i }}
            aria-label={dayText(d)}
            onPointerDown={(e) => {
              pointer.current = e.pointerType;
            }}
            onMouseEnter={() => setTip(i)}
            onFocus={() => setTip(i)}
            onClick={() => {
              pick(i);
              pointer.current = null;
            }}
          >
            <span className="hf-bar-track">
              <span className="hf-bar-fill" />
            </span>
            <span className="hf-bar-label">{d.label}</span>
          </button>
        ))}
      </div>
      <p className="hf-tip" aria-live="polite">
        {tipDay ? `${dayText(tipDay)}. Tap again to open your calendar.` : " "}
      </p>
      <p className="hf-sub">
        {full
          ? "Fully booked this week."
          : none
            ? "No open times this week."
            : // Open time is shown in hours (spec allows hours instead of start times).
              `${week.bookedCount} booked · ${hours(week.openMinLeft)} hours open`}
      </p>
    </section>
  );
}

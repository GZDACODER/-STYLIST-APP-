"use client";

// Revenue by week (or month), each column split Regulars / New. Thin
// columns from one baseline, a 2px gap between the two parts, a rounded top,
// hairline gridlines. Hover or tab to a column for its numbers; "Show as
// table" lists them all. Colors checked for color-blind readers (gold
// #a8790f and blue #3a5fb8 on white), with a legend and a table as well.
import { useState } from "react";
import { parseDateString } from "@/lib/availability";

const money = (cents) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);

// A clean top for the axis: 1, 2, 2.5 or 5 x 10^n dollars, 4 steps.
function niceMax(cents) {
  const dollars = Math.max(1, cents / 100);
  const rough = dollars / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((v) => v >= rough);
  return { maxCents: step * 4 * 100, stepCents: step * 100 };
}

function tick(cents) {
  const d = cents / 100;
  return d >= 10000 ? `$${Math.round(d / 1000)}K` : `$${d.toLocaleString("en-US")}`;
}

function bucketLabel(start, from, kind, long = false) {
  const day = parseDateString(start < from ? from : start);
  if (kind === "month") return day.toLocaleDateString("en-US", { month: long ? "long" : "short" });
  const text = day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return long ? `Week of ${text}` : text;
}

export default function RevenueChart({ series, from, kind }) {
  const [active, setActive] = useState(null);
  const totals = series.map((r) => r.regularCents + r.newCents);
  const top = Math.max(0, ...totals);

  if (series.length === 0 || top === 0) {
    return <p className="muted">No visits yet in this period.</p>;
  }

  const { maxCents, stepCents } = niceMax(top);
  const ticks = [];
  for (let v = 0; v <= maxCents; v += stepCents) ticks.push(v);
  const peak = totals.indexOf(top);
  const shown = active == null ? null : series[active];

  return (
    <div className="rc">
      <div className="rc-legend" aria-hidden="true">
        <span>
          <i className="rc-swatch regular" /> Regulars
        </span>
        <span>
          <i className="rc-swatch new" /> New
        </span>
      </div>

      <div className="rc-plot" onMouseLeave={() => setActive(null)}>
        <div className="rc-grid" aria-hidden="true">
          {ticks.map((v) => (
            <div key={v} className="rc-gridline" style={{ bottom: `${(v / maxCents) * 100}%` }}>
              <span>{tick(v)}</span>
            </div>
          ))}
        </div>

        <div className="rc-cols" role="list" aria-label="Revenue by period">
          {series.map((r, i) => {
            const total = totals[i];
            const label = bucketLabel(r.start, from, kind, true);
            return (
              <div key={r.start} className="rc-col" role="listitem">
                <button
                  type="button"
                  className={active === i ? "rc-hit active" : "rc-hit"}
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(active === i ? null : i)}
                  aria-label={`${label}: ${money(total)}. Regulars ${money(r.regularCents)}, New ${money(r.newCents)}, ${r.visits} ${r.visits === 1 ? "visit" : "visits"}`}
                >
                  <span className="rc-stack" style={{ height: `${(total / maxCents) * 100}%` }}>
                    {i === peak && total > 0 && <span className="rc-peak">{money(total)}</span>}
                    {r.newCents > 0 && <span className="rc-seg new top" style={{ flexGrow: r.newCents }} />}
                    {r.regularCents > 0 && (
                      <span
                        className={r.newCents > 0 ? "rc-seg regular" : "rc-seg regular top"}
                        style={{ flexGrow: r.regularCents }}
                      />
                    )}
                  </span>
                </button>
                <span className="rc-x" aria-hidden="true">
                  {bucketLabel(r.start, from, kind)}
                </span>
              </div>
            );
          })}
        </div>

        {shown && (
          <div className="rc-tip" role="status" style={{ left: `clamp(80px, ${((active + 0.5) / series.length) * 100}%, calc(100% - 80px))` }}>
            <strong>{bucketLabel(shown.start, from, kind, true)}</strong>
            <span>
              <i className="rc-swatch regular" /> Regulars {money(shown.regularCents)}
            </span>
            <span>
              <i className="rc-swatch new" /> New {money(shown.newCents)}
            </span>
            <span className="rc-tip-total">
              {money(shown.regularCents + shown.newCents)} · {shown.visits} {shown.visits === 1 ? "visit" : "visits"}
            </span>
          </div>
        )}
      </div>

      <details className="rc-table">
        <summary>Show as table</summary>
        <div className="table-wrap">
          <table className="rp-table">
            <thead>
              <tr>
                <th scope="col">{kind === "month" ? "Month" : "Week of"}</th>
                <th scope="col">Regulars</th>
                <th scope="col">New</th>
                <th scope="col">Total</th>
                <th scope="col">Visits</th>
              </tr>
            </thead>
            <tbody>
              {series.map((r, i) => (
                <tr key={r.start}>
                  <th scope="row">{bucketLabel(r.start, from, kind)}</th>
                  <td>{money(r.regularCents)}</td>
                  <td>{money(r.newCents)}</td>
                  <td>{money(totals[i])}</td>
                  <td>{r.visits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

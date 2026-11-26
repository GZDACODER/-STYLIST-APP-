"use client";

// "Made for your trade": pick a trade and see its own words, example
// services and highlights (from the real templates, lib/templates), with a
// link to that trade's live demo.
import { useState } from "react";
import { PhoneShot } from "./Shots";
import { announceTrade, useTradeSync } from "./tradeSync";

export default function TradeSwitcher({ trades }) {
  const [i, setI] = useState(0);
  // In step with the live Home's "Sample:" pills in the hero.
  useTradeSync("switcher", (key) => {
    const n = trades.findIndex((x) => x.key === key);
    if (n >= 0) setI(n);
  });
  const t = trades[i];
  return (
    <div className="ln-trade">
      <div className="ln-tabs" role="tablist" aria-label="Trades">
        {trades.map((x, n) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={n === i}
            aria-controls="trade-panel"
            id={`trade-${x.key}`}
            className={n === i ? "ln-tab active" : "ln-tab"}
            onClick={() => {
              setI(n);
              announceTrade(x.key, "switcher");
            }}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="ln-fx-panel is-phone" role="tabpanel" id="trade-panel" aria-labelledby={`trade-${t.key}`} key={t.key}>
        <div className="ln-fx-copy">
          <h3>{t.title}</h3>
          <p>{t.blurb}</p>
          <ul className="ln-points">
            {t.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <a href={`/demo?type=${t.demo}`} className="ln-btn ln-btn-ghost">
            Try the {t.label.toLowerCase()} demo
          </a>
        </div>
        <div className="ln-fx-visual">
          <PhoneShot src={`trade-${t.key}`} alt={`A ${t.label.toLowerCase()}'s booking page on Clientele, with their ${t.words.services} and prices`} />
        </div>
      </div>
    </div>
  );
}

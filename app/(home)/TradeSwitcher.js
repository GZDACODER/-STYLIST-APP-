"use client";

// "Made for your trade": pick a trade and see its own words, example
// services and highlights (from the real templates, lib/templates), with a
// link to that trade's live demo.
import { useState } from "react";

export default function TradeSwitcher({ trades }) {
  const [i, setI] = useState(0);
  const t = trades[i];
  return (
    <div className="hm-trade">
      <div className="hm-fx-tabs" role="tablist" aria-label="Trades">
        {trades.map((x, n) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={n === i}
            aria-controls="trade-panel"
            id={`trade-${x.key}`}
            className={n === i ? "hm-fx-tab active" : "hm-fx-tab"}
            onClick={() => setI(n)}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="hm-fx-panel hm-trade-panel" role="tabpanel" id="trade-panel" aria-labelledby={`trade-${t.key}`} key={t.key}>
        <div className="hm-fx-copy">
          <h3>{t.title}</h3>
          <p>{t.blurb}</p>
          <ul className="hm-points">
            {t.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <a href={`/demo?type=${t.demo}`} className="hm-button hm-button-ghost">
            Try the {t.label.toLowerCase()} demo
          </a>
        </div>
        <div className="hm-fx-visual" aria-hidden="true">
          <div className="hm-fx-card">
            <p className="hm-fx-label">
              Your {t.words.services} · your {t.words.clients}
            </p>
            <ul className="hm-fx-list">
              {t.services.map((s) => (
                <li key={s.name}>
                  <span>{s.name}</span>
                  <em>{s.price}</em>
                </li>
              ))}
            </ul>
            <span className="hm-fx-button">Book a {t.words.appointment}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

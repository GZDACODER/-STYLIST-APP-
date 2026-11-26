"use client";

// Keeps the landing page's two trade pickers in step: the live Home's
// "Sample:" pills in the hero and the "Made for your trade" switcher below.
// Each announces a pick on the window; the other follows. `source` lets a
// picker ignore its own announcements.
import { useEffect, useRef } from "react";

export const TRADE_EVENT = "clientele:trade";

export function announceTrade(key, source) {
  window.dispatchEvent(new CustomEvent(TRADE_EVENT, { detail: { key, source } }));
}

// onChange(key) runs when the other picker changes the trade.
export function useTradeSync(source, onChange) {
  const latest = useRef(onChange);
  useEffect(() => {
    latest.current = onChange;
  });
  useEffect(() => {
    const on = (e) => {
      if (e.detail?.source !== source) latest.current(e.detail?.key);
    };
    window.addEventListener(TRADE_EVENT, on);
    return () => window.removeEventListener(TRADE_EVENT, on);
  }, [source]);
}

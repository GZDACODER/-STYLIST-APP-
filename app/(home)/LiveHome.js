"use client";

// The landing page's hero: a live, playable Home for a sample studio. The
// same week meter and money curve as the app, fed by lib/landingDemo.js.
// Tap a move and watch the book fill or the money grow. Nothing is sent or
// saved. The sample follows the visitor's trade, in step with the "Made for
// your trade" switcher further down (tradeSync.js).
import { useEffect, useMemo, useRef, useState } from "react";
import WeekMeter from "../(studio)/dashboard/home/WeekMeter";
import MoneyCurve from "../(studio)/dashboard/home/MoneyCurve";
import { DEMO_TODAY, DEMO_TODAY_DAY, applyMove, demoView, sampleStudio } from "@/lib/landingDemo";
import DemoMoves from "./DemoMoves";
import TrialCta from "./TrialCta";
import { announceTrade, useTradeSync } from "./tradeSync";

const SOURCE = "hero";
const STEP_MS = 250;
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function LiveHome({ trades, monthLabel, lastMonthLabel }) {
  const [key, setKey] = useState(trades[0].key);
  const trade = trades.find((t) => t.key === key) || trades[0];
  const start = useMemo(() => sampleStudio(trade), [trade]);
  const [state, setState] = useState(start);
  const [announce, setAnnounce] = useState("");
  const [busy, setBusy] = useState(false);
  const timers = useRef([]);
  const movesRef = useRef(null);
  const focusFirstMove = useRef(false);
  // After "Play again" (which disappears when clicked), focus the first move.
  useEffect(() => {
    if (focusFirstMove.current) {
      focusFirstMove.current = false;
      movesRef.current?.querySelector("button")?.focus();
    }
  });

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const reset = (next = start) => {
    clearTimers();
    setBusy(false);
    setState(next);
    setAnnounce("");
  };

  // A new trade (from the pills here or the switcher below) starts over.
  const pickTrade = (k, fromHere) => {
    if (!trades.some((t) => t.key === k) || k === key) return;
    setKey(k);
    const t = trades.find((x) => x.key === k);
    reset(sampleStudio(t));
    if (fromHere) announceTrade(k, SOURCE);
  };
  useTradeSync(SOURCE, (k) => pickTrade(k, false));

  const onMove = (kind) => {
    if (busy || state.done[kind]) return;
    const { state: next, announce: said } = applyMove(state, kind);
    if (kind !== "share" || reducedMotion()) {
      setState(next);
      setAnnounce(said);
      return;
    }
    // Share: the open times fill one by one, then land on the final state.
    const added = next.bookings.slice(state.bookings.length);
    setBusy(true);
    let running = state;
    added.forEach((b, n) => {
      timers.current.push(
        setTimeout(() => {
          running = {
            ...running,
            bookings: [...running.bookings, b],
            thisDays: b.booking_date === DEMO_TODAY ? running.thisDays.map((d) => (d.day === DEMO_TODAY_DAY ? { ...d, cents: d.cents + b.priceCents } : d)) : running.thisDays,
          };
          setState(n === added.length - 1 ? next : running);
          if (n === added.length - 1) {
            setBusy(false);
            setAnnounce(said);
          }
        }, STEP_MS * (n + 1))
      );
    });
    if (!added.length) {
      setState(next);
      setBusy(false);
      setAnnounce(said);
    }
  };

  const view = demoView(state);
  const month = { ...view.month, label: monthLabel, lastLabel: lastMonthLabel };
  const anyDone = Object.values(state.done).some(Boolean);
  const allDone = Object.values(state.done).every(Boolean) && !busy;
  const tag = <span className="ln-sample-tag">Sample studio</span>;

  return (
    <figure className="ln-desk ln-live" aria-label="A live sample of the Clientele dashboard">
      <div className="ln-desk-bar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>clientelesuite.com/dashboard</span>
      </div>
      <div className="ln-live-body">
        <div className="hf-hero ln-live-hero">
          <WeekMeter week={view.week} today={DEMO_TODAY} calendarHref={null} tag={tag} everyVisit />
          <MoneyCurve month={month} today={DEMO_TODAY} moneyHref={null} tag={tag} everyVisit />
        </div>
        <p className="ln-live-label">Fill your book</p>
        <div ref={movesRef}>
          <DemoMoves state={state} openMinLeft={view.week.openMinLeft} onMove={onMove} busy={busy} words={trade.words} />
        </div>
        {allDone && (
          <div className="ln-live-done">
            <p>That&apos;s your week in Clientele.</p>
            <TrialCta small />
          </div>
        )}
        <div className="ln-live-foot">
          <div className="ln-live-trades" role="radiogroup" aria-label="Sample studio's trade">
            <span className="ln-live-trades-label">Sample:</span>
            {trades.map((t) => (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={t.key === key}
                className={t.key === key ? "ln-live-trade is-on" : "ln-live-trade"}
                onClick={() => pickTrade(t.key, true)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {anyDone && (
            <button
              type="button"
              className="ln-live-again"
              onClick={() => {
                focusFirstMove.current = true;
                reset(sampleStudio(trade));
              }}
            >
              Play again
            </button>
          )}
        </div>
        <p className="visually-hidden" role="status" aria-live="polite">
          {announce}
        </p>
      </div>
    </figure>
  );
}

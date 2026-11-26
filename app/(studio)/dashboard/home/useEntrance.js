"use client";

// Home's entrance animation plays once a day per browser: bars grow, the
// money line draws, figures count up. Later visits that day (and anyone
// who prefers reduced motion) see the finished state straight away.
import { useEffect, useRef, useState } from "react";
import { decideEntrance } from "./entrance";

// everyVisit: play on every visit (the landing page's live demo), no storage.
export function useEntrance(dateKey, { everyVisit = false } = {}) {
  const [mode, setMode] = useState("static");
  useEffect(() => {
    if (everyVisit) {
      if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setMode("play");
      return;
    }
    // Decided once per page load and shared by every card (./entrance.js).
    const reduced = Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    let storage = null;
    try {
      storage = window.localStorage;
    } catch {
      // Blocked: decideEntrance treats a throwing storage as "static".
    }
    setMode(decideEntrance(dateKey, { storage: storage || { getItem: () => { throw new Error("blocked"); } }, reduced }));
  }, [dateKey, everyVisit]);
  return mode;
}

// Counts a number up from 0 over ~700ms while `play` (the entrance). After
// that, when the target changes (the landing demo's moves), it counts from
// the number shown to the new one; with reduced motion it just jumps.
export function useCountUp(target, play) {
  const [value, setValue] = useState(target);
  const shown = useRef(target);
  const first = useRef(true);
  useEffect(() => {
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = first.current ? (play ? 0 : target) : shown.current;
    first.current = first.current && !play;
    if (reduced || from === target) {
      shown.current = target;
      setValue(target);
      return;
    }
    let frame;
    const start = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - start) / 700);
      const v = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      shown.current = v;
      setValue(v);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, play]);
  return value;
}

"use client";

// Home's entrance animation plays once a day per browser: bars grow, the
// money line draws, figures count up. Later visits that day (and anyone
// who prefers reduced motion) see the finished state straight away.
import { useEffect, useState } from "react";

export function useEntrance(dateKey) {
  const [mode, setMode] = useState("static");
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const key = `home-anim:${dateKey}`;
    let seen = false;
    try {
      seen = localStorage.getItem(key) === "1";
      localStorage.setItem(key, "1");
    } catch {
      // Storage blocked (private mode): just don't animate.
      seen = true;
    }
    if (!seen) setMode("play");
  }, [dateKey]);
  return mode;
}

// Counts a number up from 0 over ~700ms while `play`; else shows it as is.
export function useCountUp(target, play) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (!play) {
      setValue(target);
      return;
    }
    let frame;
    const start = performance.now();
    const tick = (t) => {
      const k = Math.min(1, (t - start) / 700);
      setValue(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, play]);
  return value;
}

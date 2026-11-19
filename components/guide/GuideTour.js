"use client";

// One guide on screen: a spotlight on the step's button or area with a small
// card next to it, or the card in the middle when there's nothing to point
// at. Next / Back / Skip, and Got it on the last step. Esc skips. The card
// keeps keyboard focus while it's open.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GAP = 12; // between the spotlight and the card
const PAD = 8; // around the highlighted element
const EDGE = 16; // from the screen edges

function findTarget(selectors) {
  for (const sel of selectors || []) {
    let list;
    try {
      list = document.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const el of list) {
      if (el.closest("[data-guide-layer]")) continue;
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      if (r.width > 0 && r.height > 0 && style.visibility !== "hidden" && style.display !== "none") return el;
    }
  }
  return null;
}

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function GuideTour({ guide, onFinish }) {
  const steps = guide.steps;
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState(null); // the highlighted element, or null
  const [cardPos, setCardPos] = useState(null);
  const [shown, setShown] = useState(false);
  const cardRef = useRef(null);
  const targetRef = useRef(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  // Find this step's element, bring it into view, then measure.
  useLayoutEffect(() => {
    const el = findTarget(step.target);
    targetRef.current = el;
    setShown(false);
    if (!el) {
      setRect(null);
      requestAnimationFrame(() => setShown(true));
      return;
    }
    const r = el.getBoundingClientRect();
    const inView = r.top >= 70 && r.bottom <= window.innerHeight - 90;
    if (!inView) el.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
    const t = setTimeout(
      () => {
        setRect(el.getBoundingClientRect());
        setShown(true);
      },
      inView ? 0 : 380
    );
    return () => clearTimeout(t);
  }, [index, step]);

  // Follow the element if the page scrolls or the screen turns.
  useEffect(() => {
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = targetRef.current;
        if (el && el.isConnected) setRect(el.getBoundingClientRect());
      });
    };
    window.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
    };
  }, []);

  // Place the card under the element, or above it when there's no room;
  // in the middle when there's no element.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) {
      setCardPos({ left: Math.max(EDGE, (vw - w) / 2), top: Math.max(EDGE, (vh - h) / 2), place: "center" });
      return;
    }
    const below = rect.bottom + PAD + GAP;
    const above = rect.top - PAD - GAP - h;
    let top;
    let place;
    if (below + h <= vh - EDGE) {
      top = below;
      place = "below";
    } else if (above >= EDGE) {
      top = above;
      place = "above";
    } else {
      // A tall element (most of the screen): the card sits at the bottom.
      top = vh - h - EDGE;
      place = "over";
    }
    const left = Math.min(Math.max(EDGE, rect.left + rect.width / 2 - w / 2), vw - w - EDGE);
    setCardPos({ left, top, place });
  }, [rect, index, shown]);

  // Keyboard: focus the main button on each step; Esc skips; Tab stays in the card.
  useEffect(() => {
    if (!shown) return;
    cardRef.current?.querySelector("[data-guide-primary]")?.focus({ preventScroll: true });
  }, [shown, index]);

  const onKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        // Only the guide closes (not the Assistant chat or a sheet behind it).
        e.preventDefault();
        e.stopPropagation();
        onFinish();
      } else if (e.key === "ArrowRight" && !last) {
        setIndex((i) => i + 1);
      } else if (e.key === "ArrowLeft" && index > 0) {
        setIndex((i) => i - 1);
      } else if (e.key === "Tab") {
        const items = [...cardRef.current.querySelectorAll("button")];
        const at = items.indexOf(document.activeElement);
        e.preventDefault();
        const next = (at + (e.shiftKey ? -1 : 1) + items.length) % items.length;
        items[next]?.focus();
      }
    },
    [index, last, onFinish]
  );

  useEffect(() => {
    const listener = (e) => onKeyDown(e);
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, [onKeyDown]);

  const titleId = `gd-title-${index}`;
  // Kept inside the screen, so a tall area still shows its edge.
  const spot =
    rect &&
    (() => {
      const top = Math.max(rect.top - PAD, 6);
      const bottom = Math.min(rect.bottom + PAD, window.innerHeight - 6);
      return { top, left: rect.left - PAD, width: rect.width + PAD * 2, height: Math.max(bottom - top, 0) };
    })();

  return createPortal(
    <div className="gd-layer" data-guide-layer>
      {/* Clicks outside the card don't do anything, so a stray tap doesn't skip it. */}
      <div className={spot ? "gd-catch" : "gd-catch gd-dim"} aria-hidden="true" />
      {spot && (
        <>
          {/* Four dim panels around the highlight, then a ring on it. */}
          <div className="gd-shade" style={{ top: 0, left: 0, right: 0, height: spot.top }} aria-hidden="true" />
          <div className="gd-shade" style={{ top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }} aria-hidden="true" />
          <div className="gd-shade" style={{ top: spot.top, left: 0, width: Math.max(spot.left, 0), height: spot.height }} aria-hidden="true" />
          <div
            className="gd-shade"
            style={{ top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height }}
            aria-hidden="true"
          />
          <div className="gd-spot" style={spot} aria-hidden="true" />
        </>
      )}
      <div
        ref={cardRef}
        className={`gd-card${shown && cardPos ? " is-shown" : ""} is-${cardPos?.place || "center"}`}
        style={cardPos ? { top: cardPos.top, left: cardPos.left } : { visibility: "hidden" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-guide-card
      >
        <p className="gd-count">
          {guide.title} · {index + 1} of {steps.length}
        </p>
        <h2 id={titleId} className="gd-title">
          {step.title}
        </h2>
        <p className="gd-text">{step.text}</p>
        <div className="gd-dots" aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} className={i === index ? "active" : ""} />
          ))}
        </div>
        <div className="gd-actions">
          {!last && (
            <button type="button" className="gd-skip" onClick={onFinish}>
              Skip
            </button>
          )}
          <span className="gd-spacer" />
          {index > 0 && (
            <button type="button" className="gd-back" onClick={() => setIndex((i) => i - 1)}>
              Back
            </button>
          )}
          <button
            type="button"
            className="gd-next"
            data-guide-primary
            onClick={() => (last ? onFinish() : setIndex((i) => i + 1))}
          >
            {last ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </div>,
    // Inside the dashboard or booking page wrapper, so it gets their fonts.
    document.querySelector(".db, .bk") || document.body
  );
}

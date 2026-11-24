"use client";

// A frosted panel from the right for "add" forms (wide screens); a
// full-height bottom sheet with a drag handle on phones (drag down or tap
// outside to close). Esc closes it.
import { useEffect, useRef } from "react";

export default function SlideOver({ open, onClose, title, children }) {
  const panel = useRef(null);
  const drag = useRef(null);
  // The latest onClose, so a new function each render doesn't re-run the
  // effect below (which would move focus back to the first field).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", onKey);
    const first = panel.current?.querySelector("input, select, textarea, button:not(.so-close)");
    first?.focus({ preventScroll: true });
    document.documentElement.classList.add("so-lock");
    return () => {
      window.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("so-lock");
    };
  }, [open]);
  if (!open) return null;
  const down = (e) => {
    drag.current = { y: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    if (panel.current) panel.current.style.transform = `translateY(${drag.current.dy}px)`;
  };
  const up = () => {
    const dy = drag.current?.dy || 0;
    drag.current = null;
    if (panel.current) panel.current.style.transform = "";
    if (dy > 90) onClose();
  };
  return (
    <div className="so-layer" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="sh-scrim so-scrim" aria-label="Close" onClick={onClose} />
      <section className="so-panel" ref={panel}>
        <div className="so-grip" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span className="sh-handle" aria-hidden="true" />
        </div>
        <header className="so-head">
          <h2>{title}</h2>
          <button type="button" className="sh-top-btn so-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>
        <div className="so-body">{children}</div>
      </section>
    </div>
  );
}

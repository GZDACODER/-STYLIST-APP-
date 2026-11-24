"use client";

// A small dropdown of extra actions next to a page's primary button
// (Import or invite on Clients, Export on Money). Closes when an item is
// picked, on Esc, or when tapping elsewhere.
import { useEffect, useRef } from "react";

export default function SplitMenu({ label, className = "button secondary small", children }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => {
      const el = ref.current;
      if (!el?.open) return;
      if (e.type === "keydown" ? e.key === "Escape" : !el.contains(e.target)) el.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <details className="split-menu" ref={ref}>
      <summary className={className}>
        {label} <span aria-hidden="true">▾</span>
      </summary>
      <div
        className="split-menu-list"
        onClick={(e) => {
          if (e.target.closest("a, button")) ref.current.open = false;
        }}
      >
        {children}
      </div>
    </details>
  );
}

"use client";

// A panel that opens over the page: full screen on a phone, centered on
// iPad and computer. Esc, the back link or tapping outside closes it.
// Used for a client's card (Clients) and a booking's details (Calendar).
import { useEffect, useRef } from "react";

export default function Sheet({ label, backLabel = "Back", onClose, children }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="client-sheet"
      aria-label={label}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
    >
      <div className="client-sheet-inner">
        <div className="client-sheet-bar">
          <button type="button" className="link-button" onClick={() => ref.current?.close()}>
            ‹ {backLabel}
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

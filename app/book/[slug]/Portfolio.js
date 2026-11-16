"use client";

// The business's portfolio on their booking page: a row of photos (swipe or
// scroll sideways); tapping one opens it full-size with its caption, and
// previous / next (also with the arrow keys or a swipe). Esc or "Close"
// closes it.
import { useEffect, useRef, useState } from "react";

export default function Portfolio({ photos, name }) {
  const [open, setOpen] = useState(null);
  const dialog = useRef(null);
  const touchX = useRef(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open != null && !d.open) d.showModal();
    if (open == null && d.open) d.close();
  }, [open]);

  if (!photos?.length) return null;

  const count = photos.length;
  const go = (step) => setOpen((i) => (i == null ? i : (i + step + count) % count));
  const photo = open == null ? null : photos[open];

  return (
    <section className="card bk-portfolio" aria-label={`${name}'s work`}>
      <h2>Portfolio</h2>
      <ul className="pf-strip">
        {photos.map((p, i) => (
          <li key={p.url}>
            <button type="button" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${count}${p.caption ? `: ${p.caption}` : ""}`}>
              <img src={p.url} alt={p.caption || ""} loading={i < 4 ? "eager" : "lazy"} decoding="async" />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialog}
        className="pf-viewer"
        aria-label="Portfolio photo"
        onClose={() => setOpen(null)}
        onClick={(e) => {
          if (e.target === dialog.current) setOpen(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
        onTouchStart={(e) => {
          touchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        {photo && (
          <figure>
            <img src={photo.url} alt={photo.caption || `Photo ${open + 1} of ${count}`} />
            <figcaption>
              {photo.caption && <span>{photo.caption}</span>}
              <span className="pf-count">
                {open + 1} / {count}
              </span>
            </figcaption>
          </figure>
        )}
        <div className="pf-viewer-bar">
          {count > 1 && (
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo">
              ‹
            </button>
          )}
          <button type="button" className="pf-close" onClick={() => setOpen(null)}>
            Close
          </button>
          {count > 1 && (
            <button type="button" onClick={() => go(1)} aria-label="Next photo">
              ›
            </button>
          )}
        </div>
      </dialog>
    </section>
  );
}

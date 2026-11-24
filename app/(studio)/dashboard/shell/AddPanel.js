"use client";

// A button that opens a form in the slide-over. It also opens when the
// address ends with #<id> (links like /dashboard/openings#add-opening from
// quick actions, Home or Calendar keep working), and clears the hash when
// it closes.
import { useCallback, useEffect, useState } from "react";
import SlideOver from "./SlideOver";

// trigger={false}: no button of its own (opened by a link to #<id>, e.g. from a menu).
export default function AddPanel({ id, label, title, className = "button small", trigger = true, children }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => {
      if (window.location.hash === `#${id}`) setOpen(true);
    };
    check();
    window.addEventListener("hashchange", check);
    return () => window.removeEventListener("hashchange", check);
  }, [id]);
  const close = useCallback(() => {
    setOpen(false);
    if (window.location.hash === `#${id}`) history.replaceState(null, "", window.location.pathname + window.location.search);
  }, [id]);
  return (
    <>
      {trigger && (
        <button type="button" className={className} onClick={() => setOpen(true)} aria-haspopup="dialog">
          {label}
        </button>
      )}
      <SlideOver open={open} onClose={close} title={title || label.replace(/^\+\s*/, "")}>
        <div id={id}>{children}</div>
      </SlideOver>
    </>
  );
}

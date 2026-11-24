"use client";

// Settings: a sticky bar that appears once you change something in a form on
// the page, and goes away when it's saved. "Save" submits each changed form
// (the same as its own Save button); "Discard" reloads the page.
// Forms that save on their own (a single switch) can opt out with
// data-no-savebar.
import { useEffect, useRef, useState } from "react";

export default function SaveBar() {
  const ref = useRef(null);
  const dirty = useRef(new Set());
  const [count, setCount] = useState(0);

  useEffect(() => {
    const root = ref.current?.parentElement;
    if (!root) return;
    const sync = () => setCount(dirty.current.size);
    const onEdit = (e) => {
      const el = e.target;
      const form = el?.form || el?.closest?.("form");
      if (!form || form.hasAttribute("data-no-savebar") || el.type === "search" || el.type === "file") return;
      dirty.current.add(form);
      sync();
    };
    const onDone = (e) => {
      if (dirty.current.delete(e.target)) sync();
    };
    root.addEventListener("input", onEdit);
    root.addEventListener("change", onEdit);
    root.addEventListener("submit", onDone, true);
    root.addEventListener("reset", onDone, true);
    return () => {
      root.removeEventListener("input", onEdit);
      root.removeEventListener("change", onEdit);
      root.removeEventListener("submit", onDone, true);
      root.removeEventListener("reset", onDone, true);
    };
  }, []);

  function save() {
    for (const form of [...dirty.current]) {
      if (!form.isConnected) {
        dirty.current.delete(form);
        continue;
      }
      if (form.reportValidity()) form.requestSubmit();
    }
    setCount(dirty.current.size);
  }

  return (
    <div ref={ref} className={count ? "save-bar is-on" : "save-bar"} role="region" aria-label="Unsaved changes" aria-hidden={!count}>
      {count > 0 && (
        <>
          <span>You have unsaved changes</span>
          <span className="save-bar-actions">
            <button type="button" className="button ghost small" onClick={() => window.location.reload()}>
              Discard
            </button>
            <button type="button" className="button small" onClick={save}>
              Save
            </button>
          </span>
        </>
      )}
    </div>
  );
}

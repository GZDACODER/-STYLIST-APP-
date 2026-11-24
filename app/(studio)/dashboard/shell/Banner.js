"use client";

// A slim gold banner with a Dismiss button. Dismissing hides it in this
// browser (remembered by `id`); it shows again if storage isn't available.
import { useEffect, useState } from "react";

export default function Banner({ id, children }) {
  const key = `banner-dismissed:${id}`;
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(key) === "1";
    } catch {}
    setHidden(dismissed);
  }, [key]);
  if (hidden) return null;
  return (
    <div className="late-banner" role="status">
      <div className="late-notice">
        <span>{children}</span>
        <button
          type="button"
          className="link-button small-text"
          onClick={() => {
            try {
              localStorage.setItem(key, "1");
            } catch {}
            setHidden(true);
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

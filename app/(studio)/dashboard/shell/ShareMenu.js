"use client";

// Share the booking link. On a phone: the phone's own share sheet
// (Instagram, Facebook, TikTok, Messages, WhatsApp… whatever apps they
// have). On a computer, or a phone without one: a small menu with the same
// places (lib/shareTargets.js). `trigger({ onClick, open })` draws the button.
import { useEffect, useRef, useState } from "react";
import { shareTargets } from "@/lib/shareTargets";

const GLYPH = {
  sms: (
    <path d="M4 5h16v11H9l-5 4V5z" />
  ),
  instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="4.5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="16.8" cy="7.2" r="0.6" fill="currentColor" />
    </>
  ),
  facebook: <path d="M14 8h2.5V4.5H14A3.5 3.5 0 0 0 10.5 8v2.5H8V14h2.5v6H14v-6h2.5l.5-3.5h-3V8.5c0-.3.2-.5.5-.5z" />,
  tiktok: <path d="M13 4v11a3 3 0 1 1-3-3M13 4c.5 2.6 2.2 4 5 4.2" />,
  whatsapp: (
    <>
      <path d="M5 19l1.2-3.6A7.5 7.5 0 1 1 9 18.4L5 19z" />
      <path d="M9.5 9.5c.3 2 2 3.8 4 4.4l1-1.1 1.6.8-.3 1.4c-3.6.2-7-3.2-6.8-6.8l1.4-.3.8 1.6-1 1z" fill="currentColor" stroke="none" />
    </>
  ),
  email: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="18" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
};

function Glyph({ name }) {
  return (
    <svg className="sm-glyph" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPH[name]}
    </svg>
  );
}

const canNativeShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
const isTouch = () => typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;

async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function ShareMenu({ url, businessName, trigger, align = "right" }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(null);
  const [native, setNative] = useState(false);
  const wrap = useRef(null);

  useEffect(() => setNative(canNativeShare()), []);

  // Close on a click outside or Esc.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const flash = (msg) => {
    setNote(msg);
    setTimeout(() => setNote(null), 3200);
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title: businessName, text: `Book with ${businessName}`, url });
      return true;
    } catch (e) {
      return e?.name === "AbortError";
    }
  };

  const onClick = async () => {
    // Phones: straight to the share sheet with all their apps.
    if (isTouch() && canNativeShare() && (await nativeShare())) return;
    setOpen((o) => !o);
  };

  const pick = async (t) => {
    setOpen(false);
    if (t.key === "more") {
      await nativeShare();
      return;
    }
    if (t.key === "copy" || t.copyFirst) {
      const ok = await copy(url);
      flash(ok ? t.note : url);
      if (t.copyFirst) window.open(t.href, "_blank", "noopener");
      return;
    }
    if (t.href.startsWith("http")) window.open(t.href, "_blank", "noopener,width=640,height=640");
    else window.location.href = t.href;
  };

  const targets = shareTargets(url, businessName);
  if (native) targets.push({ key: "more", label: "More apps…" });

  return (
    <span className="sm-wrap" ref={wrap}>
      {trigger({ onClick, open })}
      {open && (
        <div className={`sm-menu sm-${align}`} role="menu" aria-label="Share your booking link">
          <p className="sm-head">Share your booking link</p>
          <p className="sm-url">{url.replace(/^https:\/\/(www\.)?/, "")}</p>
          {targets.map((t) => (
            <button key={t.key} type="button" role="menuitem" className={`sm-item sm-${t.key}`} onClick={() => pick(t)}>
              <Glyph name={t.key} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      )}
      <span className="sm-note" role="status" aria-live="polite">
        {note}
      </span>
    </span>
  );
}

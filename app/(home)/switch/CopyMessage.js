"use client";

// The "tell your clients" message, with a Copy button.
import { useState } from "react";

export default function CopyMessage({ text }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: the text can still be selected by hand.
    }
  }

  return (
    <div className="hm-message">
      <p className="hm-message-text">{text}</p>
      <button type="button" className="hm-button hm-button-small" onClick={copy} aria-live="polite">
        {copied ? "Copied" : "Copy message"}
      </button>
    </div>
  );
}

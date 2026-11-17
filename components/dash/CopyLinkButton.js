"use client";

// "Copy link": copies a link (the booking page) and says "Copied!".
import { useState } from "react";

export default function CopyLinkButton({ link, label = "Copy link", className = "button secondary small" }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your booking link:", link);
    }
  }
  return (
    <button type="button" className={className} onClick={copy}>
      {copied ? "Copied!" : label}
    </button>
  );
}

"use client";

// "Share booking link": the phone's share sheet where there is one (Messages,
// Instagram...), else copies the link.
import { useState } from "react";

export default function ShareLinkButton({ link, businessName }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: businessName, text: `Book with ${businessName}`, url: link });
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your booking link:", link);
    }
  }
  return (
    <button type="button" className="button small" onClick={share}>
      {copied ? "Link copied!" : "Share booking link"}
    </button>
  );
}

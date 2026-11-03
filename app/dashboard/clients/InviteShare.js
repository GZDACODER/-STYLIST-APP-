"use client";

import { useEffect, useState } from "react";

// Share / Copy / Text buttons for one invite link.
export default function InviteShare({ slug, token, name, phone, businessName }) {
  const [copied, setCopied] = useState(false);
  // Filled in once the page is open in the browser.
  const [origin, setOrigin] = useState("");
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setCanShare(Boolean(navigator.share));
  }, []);

  const link = `${origin}/book/${slug}?invite=${token}`;
  const message = `Hi ${name}! ${businessName} has invited you to book an appointment. This link works for one booking: ${link}`;

  async function share() {
    try {
      await navigator.share({ text: message });
    } catch {
      // They closed the share sheet. Nothing to do.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy the invite:", message);
    }
  }

  return (
    <div className="row">
      {phone && (
        <a className="button small" href={`sms:${phone}&body=${encodeURIComponent(message)}`}>
          Text it
        </a>
      )}
      {canShare && (
        <button type="button" className={phone ? "button secondary small" : "button small"} onClick={share}>
          Share
        </button>
      )}
      <button type="button" className="button secondary small" onClick={copy}>
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

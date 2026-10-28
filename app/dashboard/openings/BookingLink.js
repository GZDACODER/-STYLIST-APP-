"use client";

import { useState } from "react";
import Link from "next/link";

export default function BookingLink({ link }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy your booking link:", link);
    }
  }

  return (
    <>
      <p className="booking-link">{link}</p>
      <div className="row">
        <button type="button" className="button" onClick={copyLink}>
          {copied ? "Copied!" : "Copy link"}
        </button>
        <a className="button secondary" href={link} target="_blank" rel="noreferrer">
          Open page
        </a>
      </div>
      <p className="small-text link-note">
        <Link href="/dashboard/settings">Change your link or time zone in Settings</Link>
      </p>
    </>
  );
}

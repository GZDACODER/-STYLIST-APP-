"use client";

// "See contact details": the pro's phone and email appear on a tap (kept
// out of the page until then, so they're not scraped as easily).
import { useState } from "react";

const tel = (p) => `tel:${String(p).replace(/[^0-9+]/g, "")}`;

export default function ContactReveal({ phone, email }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" className="bk-contact-btn" onClick={() => setOpen(true)}>
        See contact details
      </button>
    );
  }
  return (
    <ul className="bk-contact-details">
      {phone && (
        <li>
          <span>Phone</span> <a href={tel(phone)}>{phone}</a>
        </li>
      )}
      {email && (
        <li>
          <span>Email</span> <a href={`mailto:${email}`}>{email}</a>
        </li>
      )}
    </ul>
  );
}

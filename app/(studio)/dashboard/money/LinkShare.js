"use client";

// A payment link's Share button: the phone's share sheet (Messages,
// Instagram, WhatsApp…) or the share menu on a computer, with a message
// that says who, how much and what for.
import ShareMenu from "@/components/share/ShareMenu";

export default function LinkShare({ url, message, businessName, primary = false }) {
  return (
    <ShareMenu
      url={url}
      businessName={businessName}
      message={message}
      heading="Share payment link"
      align="left"
      trigger={({ onClick, open }) => (
        <button type="button" className={`button small${primary ? "" : " secondary"}`} aria-haspopup="menu" aria-expanded={open} onClick={onClick}>
          Share link
        </button>
      )}
    />
  );
}

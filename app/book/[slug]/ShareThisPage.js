"use client";

// "Share" at the top of a pro's booking page: clients send it to a friend.
// The phone's share sheet, or the share menu on a computer.
import ShareMenu from "@/components/share/ShareMenu";

export default function ShareThisPage({ url, name }) {
  return (
    <div className="bk-share">
      <ShareMenu
        url={url}
        businessName={name}
        heading={`Share ${name}`}
        trigger={({ onClick, open }) => (
          <button type="button" className="bk-share-btn" aria-haspopup="menu" aria-expanded={open} onClick={onClick}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5.5" r="2.5" />
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="18" cy="18.5" r="2.5" />
              <path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" />
            </svg>
            <span>Share</span>
          </button>
        )}
      />
    </div>
  );
}

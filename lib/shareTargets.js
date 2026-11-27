// The share menu for a booking link: where it can go and how. Messages,
// WhatsApp, Facebook and Email open with the link filled in. Instagram and
// TikTok don't accept a link from the web, so the link is copied first and
// the app opens for the pro to paste it (bio, story or DM). Pure.

export function shareText(businessName, url) {
  return `Book with ${businessName}: ${url}`;
}

export function shareTargets(url, businessName) {
  const text = encodeURIComponent(shareText(businessName, url));
  const pasteNote = (where) => `Link copied. Paste it in your ${where} bio, a story or a DM.`;
  return [
    { key: "sms", label: "Messages", href: `sms:?&body=${text}` },
    { key: "instagram", label: "Instagram", href: "https://www.instagram.com/", copyFirst: true, note: pasteNote("Instagram") },
    { key: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    { key: "tiktok", label: "TikTok", href: "https://www.tiktok.com/", copyFirst: true, note: pasteNote("TikTok") },
    { key: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${text}` },
    { key: "email", label: "Email", href: `mailto:?subject=${encodeURIComponent(`Book with ${businessName}`)}&body=${text}` },
    { key: "copy", label: "Copy link", note: "Link copied." },
  ];
}

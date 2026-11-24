"use client";

// Share the booking link: the phone's share sheet where there is one,
// otherwise copy it. Returns "shared", "copied" or "failed".
export async function shareBookingLink(url, businessName) {
  try {
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      await navigator.share({ title: businessName, text: `Book with ${businessName}`, url });
      return "shared";
    }
  } catch (e) {
    if (e?.name === "AbortError") return "cancelled";
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

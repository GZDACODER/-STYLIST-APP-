// The client's name and phone, remembered on their own phone after they book
// or join a waitlist, so the next form is already filled in. Kept per signed-in
// email/number (so "Not you?" on a shared device starts blank), and only in
// this browser. Browser code only.
const key = (who) => `clientele-details:${String(who || "").toLowerCase()}`;

export function loadDetails(who) {
  if (!who) return {};
  try {
    const saved = JSON.parse(window.localStorage.getItem(key(who)) || "{}");
    return { name: String(saved.name || ""), phone: String(saved.phone || ""), email: String(saved.email || "") };
  } catch {
    return {};
  }
}

export function saveDetails(who, details) {
  if (!who) return;
  try {
    window.localStorage.setItem(key(who), JSON.stringify(details));
  } catch {
    // Private browsing or storage off: nothing to remember.
  }
}

// The app owner's admin pages (e.g. /dashboard/admin/feedback). Who counts
// as an admin: the login emails in ADMIN_EMAILS in Vercel (comma-separated).
// Feedback emails go there too. Nobody is an admin until it's set.
export function adminEmails() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(user) {
  const email = String(user?.email || "").toLowerCase();
  return Boolean(email) && adminEmails().includes(email);
}

// The owner's own extra accounts: the same email with a "+tag" (like
// name+barber@gmail.com), used to run and try other business types.
// Never another person's account.
export function ownerBaseEmail(email) {
  return String(email || "").trim().toLowerCase().replace(/\+[^@]*@/, "@");
}

export function isOwnerAlias(email) {
  const e = String(email || "").trim().toLowerCase();
  return e.includes("+") && adminEmails().includes(ownerBaseEmail(e));
}

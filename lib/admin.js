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

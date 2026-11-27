// Help mode: a pro lets Clientele support into their whole dashboard for an
// hour (help_sessions, 0078 SQL). Pure; relative imports only.

export const HELP_MINUTES = 60;
// The cookie that marks the owner's browser as inside a pro's account.
export const HELP_COOKIE = "cl_help_session";

export const HELP_BLOCKED =
  "This isn't available in help mode. Billing, payouts, exports and account settings can only be changed by the pro themselves.";

export function helpExpiresAt(now = Date.now()) {
  return new Date(now + HELP_MINUTES * 60000).toISOString();
}

// "open" | "ended" | "expired" | "none"
export function helpState(session, now = Date.now()) {
  if (!session) return "none";
  if (session.ended_at) return "ended";
  if (Date.parse(session.expires_at) <= now) return "expired";
  return "open";
}

// What support did, oldest first, for the "support is done" email.
export function helpSummary(logRows) {
  return [...(logRows || [])].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).map((r) => r.action);
}

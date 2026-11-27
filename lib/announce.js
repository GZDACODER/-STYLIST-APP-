// Email all pros (/dashboard/admin/announce): who gets it and the footer.
// Never test, demo or paused accounts, and never pros who turned off
// "Clientele news" in Settings → Notifications. Pure; relative imports only.

export const AUDIENCES = [
  { key: "all", label: "Every pro" },
  { key: "trial", label: "On a free trial" },
  { key: "founding", label: "Founding pros" },
  { key: "paying", label: "Paying" },
  { key: "free", label: "Free accounts" },
  { key: "setup", label: "Not bookable yet" },
];

const IN = {
  all: () => true,
  trial: (p) => p.status?.key === "trial",
  founding: (p) => p.founding,
  paying: (p) => p.status?.key === "paying",
  free: (p) => p.status?.key === "free",
  setup: (p) => (p.step ?? 0) < 2,
};

export function audienceOf(pros, key) {
  const pick = IN[key] || IN.all;
  return pros.filter((p) => !p.test && !p.paused && p.email && p.notify?.news !== false && pick(p));
}

export function announceFooter(base) {
  return `You're getting this because you have a Clientele account. To stop Clientele news, untick it in Settings → Notifications: ${base}/dashboard/settings/notifications`;
}

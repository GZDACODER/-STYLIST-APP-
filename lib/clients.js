// Client statuses, in the order they're shown.
export const CLIENT_STATUSES = [
  { value: "regular", label: "Regular" },
  { value: "new", label: "New" },
  { value: "blocked", label: "Blocked" },
];

export const STATUS_VALUES = CLIENT_STATUSES.map((s) => s.value);

// The last 10 digits of a US number (so "+1 773..." and "773..." match).
// Null when there aren't enough digits to be sure.
export function phoneMatchKey(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  const us = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return us.length >= 7 ? us : null;
}

const emailKey = (email) => String(email || "").trim().toLowerCase() || null;

// Why two cards might be the same person: "same email", "same phone",
// "same email and phone", or null.
export function duplicateReason(a, b) {
  const email = emailKey(a.email) && emailKey(a.email) === emailKey(b.email);
  const phone = phoneMatchKey(a.phone) && phoneMatchKey(a.phone) === phoneMatchKey(b.phone);
  if (email && phone) return "Same email and phone";
  if (email) return "Same email";
  if (phone) return "Same phone";
  return null;
}

// Groups of cards that might be the same person: cards that share an email
// or phone number, joined up (if A shares an email with B and B shares a
// phone with C, all three are one group). Oldest card first in each group.
// [{ clients: [...], reason }]
export function findDuplicateGroups(clients) {
  const parent = new Map(clients.map((c) => [c.id, c.id]));
  const find = (id) => {
    while (parent.get(id) !== id) {
      parent.set(id, parent.get(parent.get(id)));
      id = parent.get(id);
    }
    return id;
  };

  const firstWithKey = new Map();
  const reasons = new Map();
  for (const c of clients) {
    const keys = [
      emailKey(c.email) && ["email", `e:${emailKey(c.email)}`],
      phoneMatchKey(c.phone) && ["phone", `p:${phoneMatchKey(c.phone)}`],
    ].filter(Boolean);
    for (const [kind, key] of keys) {
      if (!firstWithKey.has(key)) {
        firstWithKey.set(key, c.id);
        continue;
      }
      const a = find(firstWithKey.get(key));
      const b = find(c.id);
      const kinds = new Set([...(reasons.get(a) || []), ...(reasons.get(b) || []), kind]);
      if (a !== b) parent.set(b, a);
      reasons.set(a, kinds);
    }
  }

  const groups = new Map();
  for (const c of clients) {
    const root = find(c.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(c);
  }

  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([root, list]) => {
      const kinds = reasons.get(root) || new Set();
      const reason =
        kinds.has("email") && kinds.has("phone")
          ? "Same email or phone"
          : kinds.has("email")
            ? "Same email"
            : "Same phone";
      return {
        clients: list.sort((x, y) => String(x.created_at || "").localeCompare(String(y.created_at || ""))),
        reason,
      };
    });
}

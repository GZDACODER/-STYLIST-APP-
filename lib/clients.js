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

// Pairs of cards that share an email or phone number, oldest card first.
// [{ a, b, reason }]
export function findDuplicatePairs(clients) {
  const groups = new Map();
  for (const c of clients) {
    const keys = [emailKey(c.email) && `e:${emailKey(c.email)}`, phoneMatchKey(c.phone) && `p:${phoneMatchKey(c.phone)}`];
    for (const key of keys.filter(Boolean)) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(c);
    }
  }

  const seen = new Set();
  const pairs = [];
  for (const group of groups.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const [a, b] = [group[i], group[j]].sort((x, y) =>
          String(x.created_at || "").localeCompare(String(y.created_at || ""))
        );
        const id = `${a.id}|${b.id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        pairs.push({ a, b, reason: duplicateReason(a, b) });
      }
    }
  }
  return pairs;
}

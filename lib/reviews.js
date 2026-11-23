// Reviews (step 58 SQL): the stars clients leave after a completed visit.
// Safe anywhere (no secrets).

// "Maya Jones" -> "Maya J." so a review never shows a full name.
export function reviewerName(full) {
  const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A client";
  const first = parts[0][0].toUpperCase() + parts[0].slice(1);
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first;
}

export function stars(n) {
  const r = Math.max(0, Math.min(5, Math.round(n)));
  return "★".repeat(r) + "☆".repeat(5 - r);
}

// Average, count and 5-to-1 breakdown from a list of ratings.
export function ratingSummary(ratings) {
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of ratings) if (counts[r] != null) counts[r] += 1;
  const total = ratings.length;
  const average = total ? ratings.reduce((a, b) => a + b, 0) / total : null;
  return { total, average, counts };
}

export const REPORT_REASONS = [
  ["fake", "It's fake or not from a real client"],
  ["abusive", "It's abusive, hateful or harassing"],
  ["private_info", "It shares someone's private information"],
  ["other", "Something else"],
];

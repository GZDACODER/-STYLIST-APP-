// Home's entrance animation plays once a day per browser. The decision is
// made once per page load and remembered here, so every card that asks
// (This week, This month) gets the same answer, rather than the first card
// marking the day as seen and the second one then staying still.
const decided = new Map();

export function decideEntrance(dateKey, { storage, reduced }) {
  if (decided.has(dateKey)) return decided.get(dateKey);
  let mode = "static";
  if (!reduced) {
    try {
      const key = `home-anim:${dateKey}`;
      if (storage.getItem(key) !== "1") mode = "play";
      storage.setItem(key, "1");
    } catch {
      // Storage blocked (private mode): just don't animate.
      mode = "static";
    }
  }
  decided.set(dateKey, mode);
  return mode;
}

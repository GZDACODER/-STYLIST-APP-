// Help mode (lib/helpMode.js): the window a pro opens for Clientele support,
// and whether a session is still open. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { HELP_MINUTES, helpExpiresAt, helpState, HELP_BLOCKED, helpSummary } from "../lib/helpMode.js";

const NOW = Date.parse("2026-11-27T18:00:00Z");
const at = (min) => new Date(NOW + min * 60000).toISOString();

test("a help window is 1 hour from when the pro asks", () => {
  assert.equal(HELP_MINUTES, 60);
  assert.equal(helpExpiresAt(NOW), at(60));
});

test("state: open until it expires or someone ends it", () => {
  assert.equal(helpState({ expires_at: at(30), ended_at: null }, NOW), "open");
  assert.equal(helpState({ expires_at: at(-1), ended_at: null }, NOW), "expired");
  assert.equal(helpState({ expires_at: at(30), ended_at: at(-5) }, NOW), "ended");
  assert.equal(helpState(null, NOW), "none");
});

test("the blocked message says why and where", () => {
  assert.match(HELP_BLOCKED, /help mode/i);
  assert.match(HELP_BLOCKED, /owner|pro|themselves/i);
});

test("summary of what support changed, newest last, for the closing email", () => {
  const lines = helpSummary([
    { action: "Changed service: Silk Press", created_at: at(-1) },
    { action: "Clientele support opened your account (help mode)", created_at: at(-20) },
    { action: "Added opening: 2026-12-01", created_at: at(-10) },
  ]);
  assert.deepEqual(lines, ["Clientele support opened your account (help mode)", "Added opening: 2026-12-01", "Changed service: Silk Press"]);
  assert.deepEqual(helpSummary([]), []);
});

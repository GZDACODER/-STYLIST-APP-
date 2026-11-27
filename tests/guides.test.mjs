// Every tip has a title and text, and its targets are plain selector lists. Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { GUIDES } from "../lib/guides.js";

test("every guide step has a title, text and well-formed targets", () => {
  for (const [key, g] of Object.entries(GUIDES)) {
    assert.ok(g.title && g.steps.length, key);
    for (const st of g.steps) {
      assert.ok(st.title && st.text, `${key}: ${st.title}`);
      if (st.target) {
        assert.ok(Array.isArray(st.target) && st.target.every((t) => typeof t === "string" && t.length), `${key}: ${st.title}`);
        // Attribute selectors keep their quotes balanced.
        for (const t of st.target) assert.equal((t.match(/"/g) || []).length % 2, 0, `${key}: ${t}`);
      }
      if (st.optional) assert.ok(st.target, `${key}: optional step needs a target`);
    }
  }
});

test("pages keep tips short: at most 6 steps, and never all optional", () => {
  for (const [key, g] of Object.entries(GUIDES)) {
    assert.ok(g.steps.length <= 6, key);
    assert.ok(g.steps.some((s) => !s.optional), key);
  }
});

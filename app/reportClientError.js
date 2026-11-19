"use server";

// A page crashed in someone's browser (see app/error.js). Errors from the
// server are already reported by instrumentation.js; this covers the rest.
// Anyone can call it, so it's trimmed and the alerts are rate-limited.
import { reportError } from "@/lib/errorAlerts";

export async function reportClientError(message, path, stack) {
  const text = String(message || "Unknown error").slice(0, 500);
  const where = String(path || "").split("?")[0].slice(0, 200);
  const error = new Error(text);
  error.stack = `Error: ${text}\n${String(stack || "").slice(0, 1500)}`;
  await reportError("Browser error", error, { path: where });
}

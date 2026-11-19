"use client";

// Shown when a page crashes. Browser-side crashes are reported to the owner
// (server-side ones already are, by instrumentation.js).
import { useEffect } from "react";
import Link from "next/link";
import { reportClientError } from "./reportClientError";

export default function ErrorPage({ error, retry }) {
  useEffect(() => {
    const fromServer = error && typeof error === "object" && "digest" in error && error.digest;
    if (fromServer) return;
    const message = error instanceof Error ? error.message : String(error);
    reportClientError(message, window.location.pathname, error instanceof Error ? error.stack : "").catch(() => {});
  }, [error]);

  return (
    <main className="container stack">
      <h1>Something went wrong</h1>
      <p className="muted">Sorry about that. We&apos;ve been told about it. Try again, or come back in a minute.</p>
      <div className="row">
        <button type="button" className="button" onClick={() => retry()}>
          Try again
        </button>
        <Link href="/" className="button secondary">
          Go to the home page
        </Link>
      </div>
    </main>
  );
}

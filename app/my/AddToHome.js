"use client";

// "Add My Pros to your home screen". Android (Chrome) gets an Install button;
// iPhone gets the Share -> Add to Home Screen steps (Safari has no button).
// Hidden once it's opened from the home screen, or after "Not now".
import { useEffect, useState } from "react";

const DISMISS_KEY = "mypros-a2hs-dismissed";

export default function AddToHome() {
  const [mode, setMode] = useState(null); // null | "install" | "ios" | "other"
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {}
    if (standalone || dismissed) return;

    const ua = window.navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
    setMode(ios ? "ios" : "other");

    function onPrompt(event) {
      event.preventDefault();
      setPrompt(event);
      setMode("install");
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setMode(null);
  }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const choice = await prompt.userChoice.catch(() => null);
    if (choice?.outcome === "accepted") setMode(null);
    setPrompt(null);
  }

  if (!mode) return null;

  return (
    <section className="card my-a2hs" aria-label="Add My Pros to your home screen">
      <h2>Keep My Pros on your home screen</h2>
      {mode === "install" && (
        <>
          <p className="muted">Open it like an app, and book again in a couple of taps.</p>
          <div className="my-a2hs-actions">
            <button type="button" className="button" onClick={install}>
              Add to home screen
            </button>
            <button type="button" className="link-button" onClick={dismiss}>
              Not now
            </button>
          </div>
        </>
      )}
      {mode === "ios" && (
        <>
          <ol className="my-a2hs-steps">
            <li>
              Tap the <strong>Share</strong> button{" "}
              <svg width="14" height="17" viewBox="0 0 14 17" aria-label="(the square with an arrow)" role="img">
                <path d="M7 1v10M3.5 4.5 7 1l3.5 3.5M4 7H1.5v9h11V7H10" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>{" "}
              in Safari.
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong>.
            </li>
          </ol>
          <button type="button" className="link-button" onClick={dismiss}>
            Got it
          </button>
        </>
      )}
      {mode === "other" && (
        <>
          <p className="muted">
            In your browser&apos;s menu, choose <strong>Add to Home screen</strong> or{" "}
            <strong>Install app</strong>.
          </p>
          <button type="button" className="link-button" onClick={dismiss}>
            Got it
          </button>
        </>
      )}
    </section>
  );
}

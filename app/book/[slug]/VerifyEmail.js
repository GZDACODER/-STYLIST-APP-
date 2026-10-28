"use client";

import { useEffect, useState, useTransition } from "react";
import { sendCode, verifyCode } from "../actions";

// Two steps: type your email -> type the code we emailed you.
export default function VerifyEmail({ onVerified, buttonText = "Send me a code" }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState("email");
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();

  // Count down before another code can be requested.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function requestCode(event) {
    event?.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await sendCode(email);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEmail(result.email);
      setStage("code");
      setCooldown(60);
    });
  }

  function submitCode(event) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await verifyCode(email, code);
      if (result.error) setError(result.error);
      else onVerified();
    });
  }

  if (stage === "email") {
    return (
      <form onSubmit={requestCode}>
        <label>
          Your email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Sending..." : buttonText}
        </button>
        {error && <p className="message error">{error}</p>}
      </form>
    );
  }

  return (
    <form onSubmit={submitCode}>
      <p className="message info">
        We emailed a code to <strong>{email}</strong>. It can take a minute. Check your spam
        folder if you don&apos;t see it.
      </p>
      <label>
        Code
        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={12}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="code-input"
          required
        />
      </label>
      <button type="submit" className="button" disabled={pending}>
        {pending ? "Checking..." : "Confirm"}
      </button>
      {error && <p className="message error">{error}</p>}
      <div className="row-links">
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setStage("email");
            setCode("");
            setError(null);
          }}
        >
          Use a different email
        </button>
        <button
          type="button"
          className="link-button"
          disabled={cooldown > 0 || pending}
          onClick={() => requestCode()}
        >
          {cooldown > 0 ? `Send a new code (${cooldown}s)` : "Send a new code"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { sendCode, verifyCode } from "../actions";
import { formatPhone } from "@/lib/phone";

// Two steps: type your mobile number -> type the code we texted you.
// Email works the same way, as a backup.
export default function VerifyClient({ onVerified }) {
  const [method, setMethod] = useState("phone");
  const [value, setValue] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState("enter");
  const [error, setError] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [pending, startTransition] = useTransition();
  const codeForm = useRef(null);
  // Stops the code being sent twice (autofill + a tap on Confirm).
  const checking = useRef(false);
  const isPhone = method === "phone";
  const codeLength = isPhone ? 6 : 10;

  // Count down before another code can be requested.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function switchMethod(newMethod) {
    setMethod(newMethod);
    setValue("");
    setCode("");
    setStage("enter");
    setError(null);
    setCooldown(0);
  }

  function requestCode(event) {
    event?.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await sendCode(method, value);
      if (result.error) {
        setError(result.error);
        return;
      }
      setValue(result.value);
      setCode("");
      setStage("code");
      setCooldown(60);
    });
  }

  function submitCode(event) {
    event.preventDefault();
    if (checking.current) return;
    checking.current = true;
    setError(null);
    startTransition(async () => {
      const result = await verifyCode(method, value, code);
      checking.current = false;
      if (result.error) setError(result.error);
      else onVerified();
    });
  }

  function changeCode(text) {
    const digits = text.replace(/\D/g, "").slice(0, codeLength);
    setCode(digits);
    // iPhone fills in all 6 digits at once from the text message, so
    // confirm straight away without another tap.
    if (isPhone && digits.length === 6) {
      setTimeout(() => codeForm.current?.requestSubmit(), 0);
    }
  }

  if (stage === "enter") {
    return (
      <form onSubmit={requestCode}>
        {isPhone ? (
          <label>
            Your mobile number
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(555) 123-4567"
              maxLength={30}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </label>
        ) : (
          <label>
            Your email
            <input
              type="email"
              autoComplete="email"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </label>
        )}
        {isPhone && (
          <p className="muted small-text">
            We&apos;ll text you a 6-digit code. Message and data rates may apply.
          </p>
        )}
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Sending..." : isPhone ? "Text me a code" : "Email me a code"}
        </button>
        {error && <p className="message error">{error}</p>}
        <div className="row-links">
          <button
            type="button"
            className="link-button"
            onClick={() => switchMethod(isPhone ? "email" : "phone")}
          >
            {isPhone ? "Use email instead" : "Use my phone number instead"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submitCode} ref={codeForm}>
      <p className="message info">
        {isPhone ? (
          <>
            We texted a code to <strong>{formatPhone(value)}</strong>. It usually arrives in a few
            seconds.
          </>
        ) : (
          <>
            We emailed a code to <strong>{value}</strong>. It can take a minute. Check your spam
            folder if you don&apos;t see it.
          </>
        )}
      </p>
      <label>
        Code
        {/* one-time-code lets iPhones show the texted code above the keyboard. */}
        <input
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={codeLength}
          value={code}
          onChange={(e) => changeCode(e.target.value)}
          className="code-input"
          autoFocus
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
            setStage("enter");
            setCode("");
            setError(null);
          }}
        >
          {isPhone ? "Use a different number" : "Use a different email"}
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
      <div className="row-links">
        <button
          type="button"
          className="link-button"
          onClick={() => switchMethod(isPhone ? "email" : "phone")}
        >
          {isPhone ? "No text? Use email instead" : "Use my phone number instead"}
        </button>
      </div>
    </form>
  );
}

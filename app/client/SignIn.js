"use client";

// Sign in with a pro's ID and your phone number. The first time on a device,
// a code goes to the email the pro has for you; after that this device is
// remembered. "Forgot your ID?" emails it.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import PageGuide from "@/components/guide/PageGuide";
import { forgotProCode, startClientSignIn, verifyClientSignIn } from "./actions";

export default function SignIn({ initialCode = "" }) {
  const router = useRouter();
  const [stage, setStage] = useState("details"); // details | code | forgot
  const [code, setCode] = useState(initialCode);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [pending, startTransition] = useTransition();

  const go = (fn) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res?.error) setError(res.error);
      return res;
    });

  function submitDetails(e) {
    e.preventDefault();
    go(async () => {
      const res = await startClientSignIn(code, phone);
      if (res.done) router.push(`/client/${res.done}`);
      else if (res.sent) {
        setMessage(res.message);
        setStage("code");
      }
      return res;
    });
  }

  function submitCode(e) {
    e.preventDefault();
    go(async () => {
      const res = await verifyClientSignIn(code, otp);
      if (res.done) router.push(`/client/${res.done}`);
      return res;
    });
  }

  function submitForgot(e) {
    e.preventDefault();
    go(async () => {
      const res = await forgotProCode(email);
      if (res.sent) setMessage(res.message);
      return res;
    });
  }

  if (stage === "forgot") {
    return (
      <section className="card">
        <h2>Forgot the ID?</h2>
        {message ? (
          <p className="message success" role="status">
            {message}
          </p>
        ) : (
          <form onSubmit={submitForgot} className="stack">
            <p className="muted">Enter the email you book with. We&apos;ll email you the ID of each business you book with.</p>
            <label>
              Your email
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <button type="submit" className="button" disabled={pending}>
              {pending ? "Sending..." : "Email me my ID"}
            </button>
          </form>
        )}
        {error && <p className="message error">{error}</p>}
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setStage("details");
            setMessage(null);
            setError(null);
          }}
        >
          Back to sign in
        </button>
      </section>
    );
  }

  if (stage === "code") {
    return (
      <section className="card">
        <PageGuide guideKey="client_code" button={false} />
        <h2>Check your email</h2>
        <p className="message info">{message}</p>
        <form onSubmit={submitCode} className="stack">
          <label>
            Code
            <input
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="code-input"
              autoFocus
              required
            />
          </label>
          <button type="submit" className="button" disabled={pending}>
            {pending ? "Checking..." : "Sign in"}
          </button>
        </form>
        {error && <p className="message error">{error}</p>}
        <p className="muted small-text">After this, this phone stays signed in. Next time your ID and number are enough.</p>
        <button
          type="button"
          className="link-button"
          onClick={() => {
            setStage("details");
            setOtp("");
            setError(null);
          }}
        >
          Use different details
        </button>
      </section>
    );
  }

  return (
    <section className="card">
      <PageGuide guideKey="client_signin" className="gd-help-title cl-help" />
      <form onSubmit={submitDetails} className="stack" data-guide="signin-form">
        <label>
          Your pro&apos;s ID
          <input
            type="text"
            name="pro_code"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="CL-7KQ4"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className="cl-code-input"
            required
          />
        </label>
        <label>
          Your mobile number
          <input
            type="tel"
            name="phone"
            autoComplete="tel"
            inputMode="tel"
            placeholder="(555) 123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Checking..." : "Continue"}
        </button>
      </form>
      {error && <p className="message error">{error}</p>}
      <button type="button" className="link-button cl-forgot" onClick={() => setStage("forgot")} data-guide="forgot">
        Forgot the ID?
      </button>
    </section>
  );
}

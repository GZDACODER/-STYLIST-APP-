"use client";

// Sign-up in two steps: 1) business name, first name, email and password;
// 2) "What kind of business do you run?" as large cards. The choice picks
// the pro's template (lib/templates): their words, example data, intake
// form and which features show. It can be changed later in Settings.
import { useActionState, useRef, useState } from "react";
import { signup } from "@/app/auth/actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import ResendConfirmation from "@/components/ResendConfirmation";
import ConfirmCodeForm from "@/components/ConfirmCodeForm";
import { COMING_SOON, TYPE_CHOICES } from "@/lib/templates";

export default function SignupForm() {
  const [state, formAction] = useActionState(signup, null);
  const [step, setStep] = useState(1);
  const [type, setType] = useState("");
  const firstStep = useRef(null);

  const next = () => {
    // Check the first step's boxes before moving on.
    const inputs = [...(firstStep.current?.querySelectorAll("input") || [])];
    const bad = inputs.find((i) => !i.checkValidity());
    if (bad) {
      bad.reportValidity();
      return;
    }
    setStep(2);
  };

  return (
    <>
      <form action={formAction}>
        {/* Step 1 stays in the form (hidden on step 2) so it's sent too. */}
        <div ref={firstStep} className="stack" hidden={step !== 1}>
          <label>
            Business name
            <input name="business_name" type="text" placeholder="e.g. Studio Sam" required />
          </label>
          <label>
            Your first name (optional)
            <input name="first_name" type="text" autoComplete="given-name" maxLength={50} />
          </label>
          <label>
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </label>
          <button type="button" className="button" onClick={next}>
            Continue
          </button>
        </div>

        {step === 2 && (
          <div className="stack">
            <p className="au-kicker">Step 2 of 2</p>
            <h2 className="au-step-title">What kind of business do you run?</h2>
            <p className="muted small-text">
              This sets the words, example data and features you start with. You can change it any time in Settings.
            </p>
            <div className="type-cards" role="radiogroup" aria-label="Business type">
              {TYPE_CHOICES.map((t) => (
                <label key={t.value} className={type === t.value ? "type-card selected" : "type-card"}>
                  <input
                    type="radio"
                    name="business_type"
                    value={t.value}
                    checked={type === t.value}
                    onChange={() => setType(t.value)}
                    required
                  />
                  <span className="type-card-name">{t.label}</span>
                  <span className="type-card-blurb">{t.blurb}</span>
                </label>
              ))}
            </div>
            <p className="type-soon">
              <span>Coming soon</span> {COMING_SOON.join(" · ")}
            </p>
            <SubmitButton pendingText="Creating account...">Create account</SubmitButton>
            <button type="button" className="link-button small-text" onClick={() => setStep(1)}>
              ‹ Back
            </button>
          </div>
        )}
        <FormMessage state={state} />
      </form>
      {/* Didn't get the email (or the account already exists unconfirmed). */}
      {state?.email && state?.success && <ConfirmCodeForm email={state.email} />}
      {state?.email && <ResendConfirmation email={state.email} />}
    </>
  );
}

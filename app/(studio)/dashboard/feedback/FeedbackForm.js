"use client";

import { useActionState } from "react";
import { submitFeedback } from "./actions";
import { KEEP_USING, RATINGS } from "./questions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function FeedbackForm() {
  const [state, formAction] = useActionState(submitFeedback, null);

  if (state?.sentAt) {
    return (
      <div className="feedback-done">
        <p className="message success">{state.success}</p>
        <p className="muted small-text">You can send more any time from Settings → Plan &amp; billing.</p>
        <a href="/dashboard" className="button small">
          Back to Home
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="feedback-form">
      <fieldset>
        <legend>1. Overall, how is Clientele working for you?</legend>
        <div className="feedback-scale">
          {RATINGS.map((r) => (
            <label key={r.value} className="feedback-choice">
              <input type="radio" name="rating" value={r.value} required />
              <span>
                <strong>{r.value}</strong>
                {r.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>2. After your trial, how likely are you to keep using Clientele?</legend>
        <div className="feedback-options">
          {KEEP_USING.map((k) => (
            <label key={k.value} className="feedback-choice">
              <input type="radio" name="keep_using" value={k.value} />
              <span>{k.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <label>
        3. What needs updating, or isn&apos;t working the way you expected?
        <textarea name="needs_update" rows={3} maxLength={2000} placeholder="Anything confusing, missing or broken" />
      </label>

      <label>
        4. What would make your work life easier?
        <textarea name="easier" rows={3} maxLength={2000} placeholder="A feature, a shortcut, something you do by hand today" />
      </label>

      <label>
        5. Anything else? (optional)
        <textarea name="notes" rows={4} maxLength={4000} placeholder="Open notes: how you feel about the service, ideas, questions" />
      </label>

      <SubmitButton pendingText="Sending...">Send feedback</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

"use client";

// Settings -> Intake form & waiver: write the questions, the waiver, and
// pick the services that need them. Saved all at once.
import { useActionState, useState } from "react";
import { saveIntake } from "./actions";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

const TYPES = [
  { value: "text", label: "Short answer" },
  { value: "long", label: "Long answer" },
  { value: "yesno", label: "Yes / No" },
  { value: "choice", label: "Pick one" },
];

const STARTERS = [
  { label: "Any allergies or sensitivities (for example to hair dye or latex)?", type: "long", required: true },
  { label: "Any medical conditions or medications we should know about?", type: "long", required: false },
  { label: "Have you had a chemical service (color, relaxer, perm) in the last 3 months?", type: "yesno", required: true },
];

let counter = 0;
const newId = () => `q${Date.now().toString(36)}${(counter++).toString(36)}`;

export default function IntakeBuilder({ questions: initial, waiverText, services, frequency = "first", timing = "booking", starterWaiver = "", typeLabel = "" }) {
  const [state, formAction] = useActionState(saveIntake, null);
  const [questions, setQuestions] = useState(() =>
    (initial || []).map((q) => ({ ...q, optionsText: (q.options || []).join("\n") }))
  );
  const [waiver, setWaiver] = useState(waiverText || "");

  const update = (i, patch) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  const move = (i, step) =>
    setQuestions((qs) => {
      const j = i + step;
      if (j < 0 || j >= qs.length) return qs;
      const copy = [...qs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  const add = (q = { label: "", type: "text", required: false }) =>
    setQuestions((qs) => (qs.length >= 20 ? qs : [...qs, { id: newId(), optionsText: "", ...q }]));

  const payload = JSON.stringify(
    questions.map(({ optionsText, ...q }) => ({
      ...q,
      options: q.type === "choice" ? optionsText.split("\n").map((o) => o.trim()).filter(Boolean) : undefined,
    }))
  );

  return (
    <form action={formAction} className="intake-builder">
      <input type="hidden" name="questions" value={payload} />

      <section className="card">
        <h2>Questions</h2>
        <p className="muted small-text">
          Clients answer these once, the first time they book a service below. Editing them asks
          everyone again on their next booking.
        </p>

        {questions.length === 0 && (
          <div className="ib-empty">
            <p className="muted">No questions yet.</p>
            <button type="button" className="button secondary small" onClick={() => STARTERS.forEach((q) => add(q))}>
              Start with 3 common questions
            </button>
          </div>
        )}

        <ol className="ib-list">
          {questions.map((q, i) => (
            <li key={q.id} className="ib-question">
              <label>
                Question {i + 1}
                <input
                  type="text"
                  value={q.label}
                  maxLength={300}
                  onChange={(e) => update(i, { label: e.target.value })}
                  placeholder="e.g. Any allergies?"
                  required
                />
              </label>
              <div className="ib-row">
                <label>
                  Answer
                  <select value={q.type} onChange={(e) => update(i, { type: e.target.value })}>
                    {TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="check-row ib-required">
                  <input type="checkbox" checked={q.required} onChange={(e) => update(i, { required: e.target.checked })} />
                  <span>Required</span>
                </label>
              </div>
              {q.type === "choice" && (
                <label>
                  Choices (one per line)
                  <textarea
                    rows={3}
                    value={q.optionsText}
                    onChange={(e) => update(i, { optionsText: e.target.value })}
                    placeholder={"Short\nMedium\nLong"}
                  />
                </label>
              )}
              <div className="ib-actions">
                <button type="button" className="pf-move" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move question ${i + 1} up`}>
                  ↑
                </button>
                <button
                  type="button"
                  className="pf-move"
                  onClick={() => move(i, 1)}
                  disabled={i === questions.length - 1}
                  aria-label={`Move question ${i + 1} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="link-button quiet-link"
                  onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>

        {questions.length > 0 && questions.length < 20 && (
          <button type="button" className="button secondary small" onClick={() => add()}>
            Add a question
          </button>
        )}
      </section>

      <section className="card">
        <h2>Waiver</h2>
        <p className="muted small-text">
          Clients read this, tick &quot;I agree&quot;, type their full name and sign with their finger. A parent or
          guardian signs for anyone under 18. Leave it empty for no waiver. Have a lawyer check your wording.
        </p>
        {starterWaiver && waiver.trim() !== starterWaiver.trim() && (
          <p>
            <button
              type="button"
              className="button small secondary"
              onClick={() => {
                if (!waiver.trim() || window.confirm("Replace your waiver text with the starter waiver?")) setWaiver(starterWaiver);
              }}
            >
              Use the starter {typeLabel ? `${typeLabel.toLowerCase()} ` : ""}waiver
            </button>
          </p>
        )}
        <label>
          Waiver text
          <textarea
            rows={10}
            maxLength={10000}
            value={waiver}
            onChange={(e) => setWaiver(e.target.value)}
            placeholder="I understand that chemical services such as color and relaxers can cause skin or scalp irritation..."
          />
        </label>
        <input type="hidden" name="waiver_text" value={waiver} />
        <label>
          How often clients sign
          <select name="waiver_frequency" defaultValue={frequency}>
            <option value="first">Once (first visit only)</option>
            <option value="yearly">Once a year</option>
            <option value="every">Every visit</option>
          </select>
        </label>
        <label>
          When they sign
          <select name="waiver_timing" defaultValue={timing}>
            <option value="booking">While booking (they can&apos;t book until it&apos;s signed)</option>
            <option value="before">Any time before the visit (from their confirmation email)</option>
          </select>
        </label>
        <p className="muted small-text">
          With &quot;before the visit&quot;, you&apos;ll see <strong>Waiver needed</strong> on your Today page until they sign.
          Each signature is kept with a drawn signature, the exact text, the time, IP address and device, and a PDF copy
          is emailed to the client. Change the text and everyone signs the new version next time.
        </p>
      </section>

      <section className="card">
        <h2>Which services need it</h2>
        {services.length === 0 ? (
          <p className="muted">Add services first (Settings, Services &amp; prices).</p>
        ) : (
          <div className="ib-services">
            {services.map((s) => (
              <label key={s.id} className="check-row">
                <input type="checkbox" name="service" value={s.id} defaultChecked={s.intake_required} />
                <span>{s.name}</span>
              </label>
            ))}
          </div>
        )}
      </section>

      <div className="ib-save">
        <SubmitButton pendingText="Saving...">Save intake form</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}

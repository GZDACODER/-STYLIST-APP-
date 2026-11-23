"use client";

import SignaturePad from "@/components/SignaturePad";

// The intake form and waiver inside "Your details", for services that need
// them (first booking only). The answers are saved just before booking.
// intake: { questions, waiver_text }. value: { answers, signedName, agreed,
// signature (drawn, PNG data URL), forMinor, guardianName, guardianRelation }.
export default function IntakeFields({ intake, businessName, value, onChange }) {
  const { answers, signedName, agreed } = value;
  const setAnswer = (id, answer) => onChange({ ...value, answers: { ...answers, [id]: answer } });
  const questions = intake.questions || [];
  const waiver = String(intake.waiver_text || "").trim();

  return (
    <div className="intake">
      <h3>Before your first visit</h3>
      <p className="muted small-text">
        {businessName} asks new clients a few things. You only fill this in once.
      </p>

      {questions.map((q) => {
        const id = `intake-${q.id}`;
        const label = (
          <>
            {q.label}
            {q.required ? " *" : " (optional)"}
          </>
        );
        if (q.type === "yesno") {
          return (
            <fieldset key={q.id} className="intake-yesno">
              <legend>{label}</legend>
              {["Yes", "No"].map((option) => (
                <label key={option} className={answers[q.id] === option ? "intake-pill checked" : "intake-pill"}>
                  <input
                    type="radio"
                    name={id}
                    value={option}
                    checked={answers[q.id] === option}
                    onChange={() => setAnswer(q.id, option)}
                    required={q.required}
                  />
                  {option}
                </label>
              ))}
            </fieldset>
          );
        }
        if (q.type === "choice") {
          return (
            <label key={q.id} htmlFor={id}>
              {label}
              <select id={id} value={answers[q.id] || ""} onChange={(e) => setAnswer(q.id, e.target.value)} required={q.required}>
                <option value="">Choose one</option>
                {(q.options || []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          );
        }
        return (
          <label key={q.id} htmlFor={id}>
            {label}
            {q.type === "long" ? (
              <textarea id={id} rows={3} maxLength={2000} value={answers[q.id] || ""} onChange={(e) => setAnswer(q.id, e.target.value)} required={q.required} />
            ) : (
              <input id={id} type="text" maxLength={2000} value={answers[q.id] || ""} onChange={(e) => setAnswer(q.id, e.target.value)} required={q.required} />
            )}
          </label>
        );
      })}

      {waiver && (
        <div className="intake-waiver">
          <h3>Waiver</h3>
          <div className="intake-waiver-text" tabIndex={0} aria-label="Waiver text">
            {waiver}
          </div>
          <label className="check-row">
            <input type="checkbox" checked={agreed} onChange={(e) => onChange({ ...value, agreed: e.target.checked })} required />
            I&apos;ve read and agree to this waiver
          </label>
          <label>
            Type your full name to sign
            <input
              type="text"
              autoComplete="name"
              maxLength={100}
              value={signedName}
              onChange={(e) => onChange({ ...value, signedName: e.target.value })}
              required
            />
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={Boolean(value.forMinor)}
              onChange={(e) => onChange({ ...value, forMinor: e.target.checked })}
            />
            I&apos;m a parent or guardian signing for someone under 18
          </label>
          {value.forMinor && (
            <div className="intake-guardian">
              <label>
                Your full name (parent or guardian)
                <input
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  value={value.guardianName || ""}
                  onChange={(e) => onChange({ ...value, guardianName: e.target.value })}
                  required
                />
              </label>
              <label>
                Relationship
                <input
                  type="text"
                  maxLength={40}
                  placeholder="e.g. Mother"
                  value={value.guardianRelation || ""}
                  onChange={(e) => onChange({ ...value, guardianRelation: e.target.value })}
                  required
                />
              </label>
            </div>
          )}
          <SignaturePad
            name="intake_signature"
            label={value.forMinor ? "Parent or guardian signature" : "Your signature"}
            onChange={(d) => onChange({ ...value, signature: d })}
          />
          <p className="muted small-text">
            Signed {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. You&apos;ll
            get a PDF copy by email.
          </p>
        </div>
      )}
    </div>
  );
}

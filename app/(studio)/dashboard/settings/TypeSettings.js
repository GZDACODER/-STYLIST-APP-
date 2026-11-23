"use client";

// Settings > Business type: pick a type (with a preview of what changes) and
// turn features on or off. Data is never changed by either.
import { useActionState, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { COMING_SOON, MODULE_LABELS, TYPE_CHOICES, templateFor } from "@/lib/templates";
import { saveBusinessType, saveModules } from "./typeActions";

const WORD_ROWS = [
  ["clients", "Clients"],
  ["appointments", "Appointments"],
  ["services", "Services"],
  ["pro", "You"],
];

export function TypePicker({ current }) {
  const [state, action] = useActionState(saveBusinessType, null);
  const [type, setType] = useState(current);
  const now = templateFor(current);
  const next = templateFor(type);
  const changing = next.key !== now.key;
  const moduleChanges = Object.keys(MODULE_LABELS).filter((k) => now.modules[k] !== next.modules[k]);

  return (
    <form action={action} className="stack">
      <div className="type-cards" role="radiogroup" aria-label="Business type">
        {TYPE_CHOICES.map((t) => (
          <label key={t.value} className={type === t.value ? "type-card selected" : "type-card"}>
            <input type="radio" name="business_type" value={t.value} checked={type === t.value} onChange={() => setType(t.value)} />
            <span className="type-card-name">{t.label}</span>
            <span className="type-card-blurb">{t.blurb}</span>
            {templateFor(t.value).key === now.key && <span className="type-card-now">Your type now</span>}
          </label>
        ))}
      </div>
      <p className="muted small-text">
        Coming soon: {COMING_SOON.join(" · ")}
      </p>

      {changing && (
        <div className="type-preview">
          <p className="db-label">What changes</p>
          <table className="type-words">
            <tbody>
              {WORD_ROWS.map(([k, label]) => (
                <tr key={k}>
                  <th>{label}</th>
                  <td>
                    {now.words[k]} → <strong>{next.words[k]}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {moduleChanges.length > 0 && (
            <p className="small-text">
              {[
                ["Turns on", moduleChanges.filter((k) => next.modules[k])],
                ["Turns off", moduleChanges.filter((k) => !next.modules[k])],
              ]
                .filter(([, keys]) => keys.length)
                .map(([what, keys]) => `${what}: ${keys.map((k) => MODULE_LABELS[k].label).join(", ")}.`)
                .join(" ")}{" "}
              Anything you&apos;ve switched yourself below stays as you set it.
            </p>
          )}
          <p className="message info small-text">
            Your bookings, clients, notes, services and settings all stay exactly as they are. Only the words, the
            example data and which features show change, and you can switch back any time.
          </p>
          <SubmitButton pendingText="Switching...">Switch to {next.label}</SubmitButton>
        </div>
      )}
      <FormMessage state={state} />
    </form>
  );
}

export function ModuleSwitches({ modules, defaults }) {
  const [state, action] = useActionState(saveModules, null);
  return (
    <form action={action} className="stack">
      <ul className="module-list">
        {Object.entries(MODULE_LABELS).map(([key, m]) => (
          <li key={key}>
            <label className="module-row">
              <input type="checkbox" name={`m_${key}`} defaultChecked={Boolean(modules[key])} />
              <span>
                <strong>{m.label}</strong>
                <span className="muted small-text">
                  {" "}
                  {m.note}
                  {modules[key] !== defaults[key] ? " · your choice" : ""}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <SubmitButton className="button small" pendingText="Saving...">
        Save features
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

"use client";

// Two joined buttons: Everyone | Regulars only.
// "value" can also be "mixed" when a day has both kinds of openings.
export default function VisibilitySwitch({ value, onChange, label, small = false }) {
  const options = [
    { value: "everyone", label: "Everyone" },
    { value: "regulars", label: "Regulars only" },
  ];

  return (
    <div className={small ? "segmented small" : "segmented"} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`segment ${o.value}${value === o.value ? " checked" : ""}`}
          aria-pressed={value === o.value}
          onClick={() => value !== o.value && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

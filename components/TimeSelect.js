import { TIME_OPTIONS, clockTime } from "@/lib/availability";

// A time picker that always shows 12-hour times ("9:00 AM"), whatever the
// device's own settings are. Sends "09:00" style values with the form.
export default function TimeSelect({ value, defaultValue, ...props }) {
  const current = value ?? defaultValue;
  // Keep an older saved time like 9:10 AM even though it's not a 15-minute step.
  const options =
    current && !TIME_OPTIONS.includes(current)
      ? [...TIME_OPTIONS, current].sort()
      : TIME_OPTIONS;

  return (
    <select value={value} defaultValue={defaultValue} {...props}>
      {options.map((t) => (
        <option key={t} value={t}>
          {clockTime(t)}
        </option>
      ))}
    </select>
  );
}

"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { saveRules } from "./rulesActions";

const NOTICE = [
  [0, "No minimum"],
  [60, "1 hour"],
  [120, "2 hours"],
  [240, "4 hours"],
  [720, "12 hours"],
  [1440, "1 day"],
  [2880, "2 days"],
  [10080, "1 week"],
];
const AHEAD = [
  [7, "1 week"],
  [14, "2 weeks"],
  [30, "1 month"],
  [60, "2 months"],
  [90, "3 months"],
  [180, "6 months"],
  [365, "1 year"],
];
const BUFFER = [0, 5, 10, 15, 20, 30, 45, 60];

const pick = (list, v) => (list.some(([x]) => x === v) ? v : list[0][0]);

export default function RulesForm({ r, words }) {
  const [state, action] = useActionState(saveRules, null);
  return (
    <form action={action} className="stack">
      <label>
        How soon can someone book?
        <select name="min_notice_minutes" defaultValue={pick(NOTICE, r.min_notice_minutes)}>
          {NOTICE.map(([v, l]) => (
            <option key={v} value={v}>
              {v === 0 ? l : `At least ${l} ahead`}
            </option>
          ))}
        </select>
      </label>
      <label>
        How far ahead can they book?
        <select name="max_days_ahead" defaultValue={pick(AHEAD, r.max_days_ahead)}>
          {AHEAD.map(([v, l]) => (
            <option key={v} value={v}>
              Up to {l}
            </option>
          ))}
        </select>
      </label>
      <label>
        Break between {words.appointments}
        <select name="buffer_minutes" defaultValue={BUFFER.includes(r.buffer_minutes) ? r.buffer_minutes : 0}>
          {BUFFER.map((v) => (
            <option key={v} value={v}>
              {v ? `${v} minutes` : "No break"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Start times
        <select name="slot_step_minutes" defaultValue={r.slot_step_minutes}>
          <option value={15}>Every 15 minutes (9:00, 9:15, 9:30…)</option>
          <option value={30}>Every 30 minutes (9:00, 9:30…)</option>
          <option value={60}>On the hour (9:00, 10:00…)</option>
        </select>
      </label>
      <label>
        Most {words.appointments} in a day
        <input name="daily_limit" type="number" min={0} max={40} inputMode="numeric" defaultValue={r.daily_limit ?? ""} placeholder="No limit" />
      </label>
      <p className="muted small-text">These apply to new bookings. Ones already booked stay as they are.</p>
      <SubmitButton pendingText="Saving...">Save booking rules</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

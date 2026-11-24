"use client";

import { useActionState } from "react";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import { createProject, updateProject } from "./actions";

export const STATUS_LABEL = { planning: "Planning", in_progress: "In progress", healing: "Healing", done: "Done" };

export function NewProjectForm({ clients }) {
  const [state, action] = useActionState(createProject, null);
  return (
    <form action={action} className="stack">
      <label>
        Client
        <select name="client_id" defaultValue="" required>
          <option value="" disabled>
            Choose a client
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="mn-grid">
        <label>
          Project
          <input name="title" maxLength={100} placeholder="e.g. Botanical sleeve" required />
        </label>
        <label>
          Placement
          <input name="placement" maxLength={100} placeholder="e.g. Left arm" />
        </label>
        <label>
          Sessions planned
          <input name="sessions_planned" type="number" min={1} max={50} inputMode="numeric" placeholder="e.g. 4" />
        </label>
      </div>
      <label>
        Notes (only you see these)
        <textarea name="notes" rows={3} maxLength={2000} placeholder="Design, colors, what's done and what's next" />
      </label>
      <SubmitButton pendingText="Saving...">Start project</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function EditProjectForm({ p }) {
  const [state, action] = useActionState(updateProject, null);
  return (
    <form action={action} className="stack">
      <input type="hidden" name="id" value={p.id} />
      <div className="mn-grid">
        <label>
          Project
          <input name="title" maxLength={100} defaultValue={p.title} required />
        </label>
        <label>
          Placement
          <input name="placement" maxLength={100} defaultValue={p.placement || ""} />
        </label>
        <label>
          Sessions planned
          <input name="sessions_planned" type="number" min={1} max={50} defaultValue={p.sessions_planned ?? ""} />
        </label>
        <label>
          Status
          <select name="status" defaultValue={p.status}>
            {Object.entries(STATUS_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Notes (only you see these)
        <textarea name="notes" rows={4} maxLength={2000} defaultValue={p.notes || ""} />
      </label>
      <SubmitButton pendingText="Saving...">Save</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

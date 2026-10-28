"use client";

import { useActionState, useEffect, useOptimistic, useState, startTransition } from "react";
import { deleteClient, setClientStatus, updateClient } from "./actions";
import { CLIENT_STATUSES } from "@/lib/clients";
import ClientFields from "./ClientFields";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";

export default function ClientCard({ client }) {
  const [editing, setEditing] = useState(false);
  const [statusError, setStatusError] = useState(null);
  // Show the new status straight away while it saves in the background.
  const [status, setOptimisticStatus] = useOptimistic(client.status);
  const [editState, editAction] = useActionState(updateClient, null);

  // Close the edit form after a successful save.
  useEffect(() => {
    if (editState?.savedAt) setEditing(false);
  }, [editState?.savedAt]);

  function changeStatus(newStatus) {
    if (newStatus === status) return;
    setStatusError(null);
    startTransition(async () => {
      setOptimisticStatus(newStatus);
      const result = await setClientStatus(client.id, newStatus);
      if (result?.error) setStatusError(result.error);
    });
  }

  function confirmDelete(event) {
    if (!window.confirm(`Delete ${client.name}? This can't be undone.`)) {
      event.preventDefault();
    }
  }

  if (editing) {
    return (
      <li className="client-card">
        <form action={editAction}>
          <input type="hidden" name="id" value={client.id} />
          <ClientFields values={client} />
          <div className="row">
            <button type="button" className="button secondary" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <SubmitButton pendingText="Saving...">Save</SubmitButton>
          </div>
          <FormMessage state={editState?.error ? editState : null} />
        </form>
      </li>
    );
  }

  return (
    <li className="client-card">
      <div className="client-top">
        <div className="client-name">{client.name}</div>
        <button type="button" className="link-button" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>

      {(client.phone || client.email) && (
        <div className="client-contact">
          {client.phone && <a href={`tel:${client.phone}`}>{client.phone}</a>}
          {client.email && <a href={`mailto:${client.email}`}>{client.email}</a>}
        </div>
      )}
      {client.notes && <p className="client-notes">{client.notes}</p>}
      <p className="muted small-text">
        {client.completed_visits === 1 ? "1 visit" : `${client.completed_visits || 0} visits`}
        {status === "new" &&
          !client.auto_regular &&
          " · Won't be made a Regular automatically, because you took them off Regular"}
      </p>

      <div className="segmented" role="group" aria-label={`Status for ${client.name}`}>
        {CLIENT_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            className={`segment ${s.value}${status === s.value ? " checked" : ""}`}
            aria-pressed={status === s.value}
            onClick={() => changeStatus(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {statusError && <p className="message error">Couldn't change status: {statusError}</p>}

      <form action={deleteClient} onSubmit={confirmDelete} className="client-delete">
        <input type="hidden" name="id" value={client.id} />
        <SubmitButton className="link-button danger" pendingText="Deleting...">
          Delete client
        </SubmitButton>
      </form>
    </li>
  );
}

"use client";

import { useActionState, useEffect, useOptimistic, useState, startTransition } from "react";
import { deleteClient, setClientStatus, updateClient } from "./actions";
import { CLIENT_STATUSES } from "@/lib/clients";
import ClientFields from "./ClientFields";
import SubmitButton from "@/components/SubmitButton";
import FormMessage from "@/components/FormMessage";
import RegularStar from "@/components/RegularStar";
import ConfirmAction from "@/components/ConfirmAction";
import { displayPhone } from "@/lib/phone";
import StandingSection from "../standing/StandingSection";
import ClientHistory from "./ClientHistory";
import ClientIntake from "./ClientIntake";
import MergeClients from "./MergeClients";

// The full card, shown in a panel when a row in the client list is tapped.
// standing: what the standing appointment part needs (see ClientsPage).
// clients, upcomingCounts, mergeWith: for "Merge with another card".
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "11-19" -> "Nov 19"
const birthdayText = (md) => `${MONTHS[Number(md.slice(0, 2)) - 1]} ${Number(md.slice(3))}`;
const todayMonthDay = () => {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function ClientCard({ client, standing, clients, upcomingCounts, mergeWith }) {
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

  if (editing) {
    return (
      <div className="client-card">
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
      </div>
    );
  }

  return (
    <div className="client-card">
      <div className="client-top">
        <div className="client-name">
          {client.name}
          {client.invited_at && <span className="badge invited">Invited</span>}
        </div>
        <button type="button" className="link-button" onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>

      {(client.phone || client.email) && (
        <div className="client-contact">
          {client.phone && <a href={`tel:${client.phone}`}>{displayPhone(client.phone)}</a>}
          {client.email && <a href={`mailto:${client.email}`}>{client.email}</a>}
        </div>
      )}
      {client.notes && <p className="client-notes">{client.notes}</p>}
      {(client.birthday || client.feedback) && (
        <div className="client-extras">
          {client.birthday && (
            <p className="small-text">
              <strong>Birthday:</strong> {birthdayText(client.birthday)}
              {client.birthday === todayMonthDay() && <span className="badge paid"> Today!</span>}
            </p>
          )}
          {client.feedback && (
            <p className="small-text">
              <strong>Feedback:</strong> <span className="rp-stars">{"★".repeat(Math.round(client.feedback.average))}</span>{" "}
              {client.feedback.average.toFixed(1)} from {client.feedback.count}{" "}
              {client.feedback.count === 1 ? "visit" : "visits"}
              {client.feedback.last?.comment && (
                <>
                  {" "}
                  · latest: &ldquo;{client.feedback.last.comment}&rdquo;
                </>
              )}
            </p>
          )}
        </div>
      )}
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
            {s.value === "regular" && (
              <>
                <RegularStar label={null} />{" "}
              </>
            )}
            {s.label}
          </button>
        ))}
      </div>
      {statusError && <p className="message error">Couldn't change status: {statusError}</p>}

      <ClientHistory clientId={client.id} />
      <ClientIntake clientId={client.id} />

      {/* Standing appointments are for Regulars only. */}
      {standing && (status !== "blocked" || standing.series.some((x) => x.client_id === client.id)) && (
        <StandingSection client={client} standing={standing} isRegular={status === "regular"} />
      )}

      <MergeClients
        client={client}
        clients={clients || []}
        standing={standing}
        upcomingCounts={upcomingCounts}
        initialOtherId={mergeWith}
      />

      <div className="client-delete">
        <ConfirmAction
          label="Delete client"
          question={`Delete ${client.name}?`}
          note="This can't be undone."
          keepLabel="Keep client"
          confirmLabel="Yes, delete"
          pendingText="Deleting..."
          action={deleteClient}
          fields={{ id: client.id }}
        />
      </div>
    </div>
  );
}
